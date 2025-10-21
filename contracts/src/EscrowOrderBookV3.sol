// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {Ownable} from "solady/auth/Ownable.sol";
import {ReentrancyGuard} from "solady/utils/ReentrancyGuard.sol";

/**
 * @title EscrowOrderBookV3
 * @notice Pre-TGE OTC trading with collateralized escrow
 * @dev V3 improvements:
 *   - Uses bytes32 projectId instead of address (no fake addresses before TGE)
 *   - Uses Solady for Ownable/ReentrancyGuard (gas optimized, battle-tested)
 *   - Combines take+deposit into single transaction
 *   - Auto-settles on token deposit (no manual claim step)
 */
contract EscrowOrderBookV3 is Ownable, ReentrancyGuard {
    enum Status { 
        OPEN,           // Order created, awaiting counterparty
        FUNDED,         // Both parties locked collateral
        TGE_ACTIVATED,  // Admin started settlement window
        SETTLED,        // Complete - tokens delivered (auto-settled)
        DEFAULTED,      // One party defaulted
        CANCELED        // Order canceled (Good-Til-Cancel - no expiry)
    }

    struct Order {
        uint256 id;
        address maker;
        address buyer;
        address seller;
        bytes32 projectId;             // keccak256(slug) - e.g., keccak256("lighter")
        uint256 amount;                // Token amount (18 decimals)
        uint256 unitPrice;             // Price per token (stable decimals, e.g., 6 for USDC)
        uint256 buyerFunds;            // Locked stable from buyer
        uint256 sellerCollateral;      // Locked stable from seller
        uint64 settlementDeadline;     // TGE settlement deadline
        bool isSell;                   // true = maker sells, false = maker buys
        Status status;
    }

    // Mapping from orderId => actual token address (set during TGE activation)
    mapping(uint256 => address) public actualTokenAddress;
    
    // Track which projects have had TGE activated (prevents new orders after TGE)
    mapping(bytes32 => bool) public projectTgeActivated;
    
    // Proof submission for Points (off-chain settlement)
    mapping(uint256 => string) public settlementProof; // orderId => proof (tx hash, screenshot, etc.)
    mapping(uint256 => uint64) public proofSubmittedAt; // orderId => timestamp

    IERC20 public immutable stable;
    uint8 public immutable stableDecimals;

    uint256 public nextId = 1;
    mapping(uint256 => Order) public orders;
    
    bool public paused;

    // Settlement configuration
    uint256 public constant DEFAULT_SETTLEMENT_WINDOW = 4 hours;
    uint256 public constant EXTENSION_4H = 4 hours;
    uint256 public constant EXTENSION_24H = 24 hours;
    
    // Risk management
    uint256 public constant MAX_ORDER_VALUE = 1_000_000 * 10**6; // 1M USDC max per order
    uint256 public constant MAX_PROOF_LENGTH = 500; // 500 characters max for proof strings

    // Events
    event OrderCreated(uint256 indexed id, address indexed maker, bool isSell, bytes32 indexed projectId, uint256 amount, uint256 unitPrice);
    event OrderFunded(uint256 indexed id, address buyer, address seller);
    event TGEActivated(uint256 indexed id, address tokenAddress, uint64 deadline);
    event SettlementExtended(uint256 indexed id, uint64 newDeadline, uint256 extensionHours);
    event OrderSettled(uint256 indexed id, address buyer, address seller, uint256 totalPaid);
    event OrderCanceled(uint256 indexed id);
    event DefaultedToBuyer(uint256 indexed id, uint256 compensation);
    event DefaultedToSeller(uint256 indexed id, uint256 refund);
    event ManualSettlement(uint256 indexed id); // For Points
    event ProofSubmitted(uint256 indexed id, address seller, string proof);
    event Paused(address indexed account);
    event Unpaused(address indexed account);

    modifier whenNotPaused() {
        require(!paused, "PAUSED");
        _;
    }

    constructor(address stableToken) {
        require(stableToken != address(0), "STABLE_ZERO");
        stable = IERC20(stableToken);
        stableDecimals = IERC20(stableToken).decimals();
        _initializeOwner(msg.sender);
    }

    // ========== ADMIN FUNCTIONS ==========

    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    // ========== INTERNAL HELPERS ==========

    function _total(uint256 amount, uint256 unitPrice) internal pure returns (uint256) {
        // amount is in 18 decimals (token), unitPrice is in stable decimals (e.g., 6)
        // We need to return the total in stable decimals
        // So: (amount * unitPrice) / 10^18
        return (amount * unitPrice) / 1e18;
    }

    function _validate(uint256 amount, uint256 unitPrice) internal view {
        require(amount > 0, "AMOUNT");
        require(unitPrice > 0, "PRICE");
        
        // Check max order value to prevent fat-finger errors and DoS attacks
        uint256 totalInStableDecimals = (amount * unitPrice) / 1e18;
        require(totalInStableDecimals <= MAX_ORDER_VALUE, "EXCEEDS_MAX_VALUE");
    }

    // ========== ORDER CREATION ==========

    /// @notice Create a sell order (seller offers project tokens) - Good-Til-Cancel (GTC)
    function createSellOrder(uint256 amount, uint256 unitPrice, bytes32 projectId)
        external whenNotPaused nonReentrant returns (uint256 id)
    {
        require(projectId != bytes32(0), "ZERO_PROJECT_ID");
        require(!projectTgeActivated[projectId], "TGE_ALREADY_ACTIVATED");
        _validate(amount, unitPrice);

        id = nextId++;
        orders[id] = Order({
            id: id,
            maker: msg.sender,
            buyer: address(0),
            seller: msg.sender,
            projectId: projectId,
            amount: amount,
            unitPrice: unitPrice,
            buyerFunds: 0,
            sellerCollateral: 0, // Seller will lock collateral next
            settlementDeadline: 0,
            isSell: true,
            status: Status.OPEN
        });

        emit OrderCreated(id, msg.sender, true, projectId, amount, unitPrice);
    }

    /// @notice Create a buy order (buyer wants project tokens) - Good-Til-Cancel (GTC)
    function createBuyOrder(uint256 amount, uint256 unitPrice, bytes32 projectId)
        external whenNotPaused nonReentrant returns (uint256 id)
    {
        require(projectId != bytes32(0), "ZERO_PROJECT_ID");
        require(!projectTgeActivated[projectId], "TGE_ALREADY_ACTIVATED");
        _validate(amount, unitPrice);

        id = nextId++;
        orders[id] = Order({
            id: id,
            maker: msg.sender,
            buyer: msg.sender,
            seller: address(0),
            projectId: projectId,
            amount: amount,
            unitPrice: unitPrice,
            buyerFunds: 0, // Buyer will lock funds next
            sellerCollateral: 0,
            settlementDeadline: 0,
            isSell: false,
            status: Status.OPEN
        });

        emit OrderCreated(id, msg.sender, false, projectId, amount, unitPrice);
    }

    /// @notice Seller locks collateral for their sell order
    function lockSellerCollateral(uint256 id) external nonReentrant {
        Order storage o = orders[id];
        require(o.status == Status.OPEN, "NOT_OPEN");
        require(o.isSell, "NOT_SELL_ORDER");
        require(msg.sender == o.seller, "NOT_SELLER");
        require(o.sellerCollateral == 0, "ALREADY_LOCKED");

        uint256 total = _total(o.amount, o.unitPrice);
        o.sellerCollateral = total;

        require(stable.transferFrom(msg.sender, address(this), total), "TRANSFER_FAILED");

        // If buyer already took the order and deposited funds, mark as FUNDED
        if (o.buyer != address(0) && o.buyerFunds > 0) {
            o.status = Status.FUNDED;
            emit OrderFunded(id, o.buyer, o.seller);
        }
    }

    /// @notice Take a sell order and deposit buyer funds in one transaction
    function takeSellOrder(uint256 id) external nonReentrant whenNotPaused {
        Order storage o = orders[id];
        require(o.status == Status.OPEN, "NOT_OPEN");
        require(o.isSell, "NOT_SELL_ORDER");
        require(o.buyer == address(0), "ALREADY_TAKEN");
        require(msg.sender != o.seller, "CANT_TAKE_OWN");

        o.buyer = msg.sender;
        
        // Immediately deposit buyer funds in same transaction
        uint256 total = _total(o.amount, o.unitPrice);
        o.buyerFunds = total;
        require(stable.transferFrom(msg.sender, address(this), total), "TRANSFER_FAILED");

        // If seller already deposited collateral, mark as FUNDED
        if (o.sellerCollateral > 0) {
            o.status = Status.FUNDED;
            emit OrderFunded(id, o.buyer, o.seller);
        }
    }

    /// @notice Buyer locks funds for their buy order
    function lockBuyerFunds(uint256 id) external nonReentrant {
        Order storage o = orders[id];
        require(o.status == Status.OPEN, "NOT_OPEN");
        require(!o.isSell, "NOT_BUY_ORDER");
        require(msg.sender == o.buyer, "NOT_BUYER");
        require(o.buyerFunds == 0, "ALREADY_LOCKED");

        uint256 total = _total(o.amount, o.unitPrice);
        o.buyerFunds = total;

        require(stable.transferFrom(msg.sender, address(this), total), "TRANSFER_FAILED");

        // If seller already took the order and deposited collateral, mark as FUNDED
        if (o.seller != address(0) && o.sellerCollateral > 0) {
            o.status = Status.FUNDED;
            emit OrderFunded(id, o.buyer, o.seller);
        }
    }

    /// @notice Take a buy order and deposit seller collateral in one transaction
    function takeBuyOrder(uint256 id) external nonReentrant whenNotPaused {
        Order storage o = orders[id];
        require(o.status == Status.OPEN, "NOT_OPEN");
        require(!o.isSell, "NOT_BUY_ORDER");
        require(o.seller == address(0), "ALREADY_TAKEN");
        require(msg.sender != o.buyer, "CANT_TAKE_OWN");

        o.seller = msg.sender;
        
        // Immediately deposit seller collateral in same transaction
        uint256 total = _total(o.amount, o.unitPrice);
        o.sellerCollateral = total;
        require(stable.transferFrom(msg.sender, address(this), total), "TRANSFER_FAILED");

        // If buyer already deposited funds, mark as FUNDED
        if (o.buyerFunds > 0) {
            o.status = Status.FUNDED;
            emit OrderFunded(id, o.buyer, o.seller);
        }
    }

    /// @notice Cancel an unfunded order
    function cancelOrder(uint256 id) external nonReentrant {
        Order storage o = orders[id];
        require(o.status == Status.OPEN, "NOT_OPEN");
        require(msg.sender == o.maker, "NOT_MAKER");

        o.status = Status.CANCELED;

        // Refund any locked collateral
        if (o.buyerFunds > 0) {
            require(stable.transfer(o.buyer, o.buyerFunds), "TRANSFER_FAILED");
        }
        if (o.sellerCollateral > 0) {
            require(stable.transfer(o.seller, o.sellerCollateral), "TRANSFER_FAILED");
        }

        emit OrderCanceled(id);
    }

    // ========== TGE ACTIVATION (ADMIN) ==========

    /// @notice Batch activate TGE for multiple orders (gas efficient)
    /// @param orderIds Array of order IDs to activate (must all be same project)
    /// @param actualToken The actual deployed token address
    function batchActivateTGE(uint256[] calldata orderIds, address actualToken) external onlyOwner {
        require(orderIds.length > 0, "EMPTY_ARRAY");
        require(actualToken != address(0), "ZERO_TOKEN");
        require(actualToken != address(stable), "CANT_BE_STABLE");
        
        // For Points projects, allow placeholder address
        bool isPointsProject = (actualToken == 0x000000000000000000000000000000000000dEaD);
        
        if (!isPointsProject) {
            // Validate it's a real ERC20
            try IERC20(actualToken).totalSupply() returns (uint256) {
                // Valid token
            } catch {
                revert("INVALID_TOKEN");
            }
        }

        uint64 deadline = uint64(block.timestamp + DEFAULT_SETTLEMENT_WINDOW);
        bytes32 projectId;

        for (uint256 i = 0; i < orderIds.length; i++) {
            uint256 orderId = orderIds[i];
            require(orderId > 0 && orderId < nextId, "INVALID_ORDER_ID");
            
            Order storage o = orders[orderId];
            require(o.status == Status.FUNDED, "NOT_FUNDED");
            
            if (i == 0) {
                projectId = o.projectId;
                projectTgeActivated[projectId] = true; // Mark project as TGE activated
            } else {
                require(o.projectId == projectId, "MIXED_PROJECTS");
            }
            
            actualTokenAddress[orderId] = actualToken;
            o.settlementDeadline = deadline;
            o.status = Status.TGE_ACTIVATED;
            
            emit TGEActivated(orderId, actualToken, deadline);
        }
    }

    /// @notice Extend settlement deadline
    function extendSettlement(uint256 id, uint256 extensionHours) external onlyOwner {
        Order storage o = orders[id];
        require(o.status == Status.TGE_ACTIVATED, "NOT_TGE_ACTIVATED");
        require(extensionHours == 4 || extensionHours == 24, "INVALID_EXTENSION");

        uint256 extension = extensionHours == 4 ? EXTENSION_4H : EXTENSION_24H;
        o.settlementDeadline = uint64(uint256(o.settlementDeadline) + extension);

        emit SettlementExtended(id, o.settlementDeadline, extensionHours);
    }

    // ========== SETTLEMENT (TOKENS) ==========

    /// @notice Seller deposits tokens - AUTO-SETTLES to buyer and pays seller
    function depositTokensForSettlement(uint256 id) external nonReentrant {
        Order storage o = orders[id];
        require(o.status == Status.TGE_ACTIVATED, "NOT_TGE_ACTIVATED");
        require(msg.sender == o.seller, "NOT_SELLER");
        require(block.timestamp <= o.settlementDeadline, "DEADLINE_PASSED");

        address tokenAddr = actualTokenAddress[id];
        require(tokenAddr != address(0), "NO_TOKEN_ADDRESS");
        require(tokenAddr != 0x000000000000000000000000000000000000dEaD, "USE_PROOF_SUBMISSION");

        // Pull tokens from seller
        IERC20 token = IERC20(tokenAddr);
        require(token.transferFrom(msg.sender, address(this), o.amount), "TOKEN_TRANSFER_FAILED");

        // Mark as settled
        o.status = Status.SETTLED;

        // Auto-settle: send tokens to buyer
        require(token.transfer(o.buyer, o.amount), "TOKEN_TRANSFER_TO_BUYER_FAILED");

        // Auto-settle: send payment + collateral to seller
        uint256 total = o.buyerFunds + o.sellerCollateral;
        require(stable.transfer(o.seller, total), "STABLE_TRANSFER_TO_SELLER_FAILED");

        emit OrderSettled(id, o.buyer, o.seller, o.buyerFunds);
    }

    // ========== SETTLEMENT (POINTS - OFF-CHAIN) ==========

    /// @notice Seller submits proof of Points delivery (screenshot, tx hash, etc.)
    function submitProof(uint256 id, string calldata proof) external nonReentrant {
        Order storage o = orders[id];
        require(o.status == Status.TGE_ACTIVATED, "NOT_TGE_ACTIVATED");
        require(msg.sender == o.seller, "NOT_SELLER");
        require(bytes(proof).length > 0 && bytes(proof).length <= MAX_PROOF_LENGTH, "INVALID_PROOF");

        settlementProof[id] = proof;
        proofSubmittedAt[id] = uint64(block.timestamp);

        emit ProofSubmitted(id, msg.sender, proof);
    }

    /// @notice Admin manually settles Points order after verifying proof
    function manualSettle(uint256 id) external onlyOwner nonReentrant {
        Order storage o = orders[id];
        require(o.status == Status.TGE_ACTIVATED, "NOT_TGE_ACTIVATED");
        require(proofSubmittedAt[id] > 0, "NO_PROOF_SUBMITTED");

        o.status = Status.SETTLED;

        // Pay seller: buyer's payment + seller's collateral returned
        uint256 total = o.buyerFunds + o.sellerCollateral;
        require(stable.transfer(o.seller, total), "TRANSFER_FAILED");

        emit ManualSettlement(id);
        emit OrderSettled(id, o.buyer, o.seller, o.buyerFunds);
    }

    // ========== DEFAULTS (ADMIN) ==========

    /// @notice Handle seller default (didn't deliver tokens/proof)
    function defaultToSeller(uint256 id) external onlyOwner nonReentrant {
        Order storage o = orders[id];
        require(o.status == Status.TGE_ACTIVATED, "NOT_TGE_ACTIVATED");
        require(block.timestamp > o.settlementDeadline, "DEADLINE_NOT_PASSED");

        o.status = Status.DEFAULTED;

        // Buyer gets their funds back + seller's collateral as compensation
        uint256 compensation = o.buyerFunds + o.sellerCollateral;
        require(stable.transfer(o.buyer, compensation), "TRANSFER_FAILED");

        emit DefaultedToBuyer(id, compensation);
    }

    /// @notice Handle buyer default (special admin-only case)
    function defaultToBuyer(uint256 id) external onlyOwner nonReentrant {
        Order storage o = orders[id];
        require(o.status == Status.TGE_ACTIVATED || o.status == Status.FUNDED, "INVALID_STATUS");

        o.status = Status.DEFAULTED;

        // Seller gets their collateral back + buyer's funds as compensation
        uint256 refund = o.sellerCollateral + o.buyerFunds;
        require(stable.transfer(o.seller, refund), "TRANSFER_FAILED");

        emit DefaultedToSeller(id, refund);
    }

    // ========== VIEW FUNCTIONS ==========

    function getOrder(uint256 id) external view returns (Order memory) {
        return orders[id];
    }

    function getOrdersByProject(bytes32 projectId) external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i < nextId; i++) {
            if (orders[i].projectId == projectId) {
                count++;
            }
        }

        uint256[] memory result = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i < nextId; i++) {
            if (orders[i].projectId == projectId) {
                result[index] = i;
                index++;
            }
        }

        return result;
    }
}

