// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";

/// Minimal Ownable, Pausable, ReentrancyGuard to avoid external deps
abstract contract Ownable {
    address public owner;
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    constructor() { owner = msg.sender; emit OwnershipTransferred(address(0), msg.sender); }
    modifier onlyOwner() { require(msg.sender == owner, "NOT_OWNER"); _; }
    function transferOwnership(address newOwner) external onlyOwner { require(newOwner != address(0), "ZERO"); emit OwnershipTransferred(owner, newOwner); owner = newOwner; }
}

abstract contract Pausable is Ownable {
    bool public paused;
    event Paused(address indexed account);
    event Unpaused(address indexed account);
    modifier whenNotPaused() { require(!paused, "PAUSED"); _; }
    function pause() external onlyOwner { paused = true; emit Paused(msg.sender); }
    function unpause() external onlyOwner { paused = false; emit Unpaused(msg.sender); }
}

abstract contract ReentrancyGuard { uint256 private locked = 1; modifier nonReentrant(){ require(locked==1, "REENTRANCY"); locked=2; _; locked=1; } }

contract EscrowOrderBookV2 is Pausable, ReentrancyGuard {
    enum Status { 
        OPEN,           // Order created, awaiting counterparty
        FUNDED,         // Both parties locked collateral
        TGE_ACTIVATED,  // Admin started settlement window
        TOKENS_DEPOSITED, // Seller deposited tokens
        SETTLED,        // Complete - tokens delivered
        DEFAULTED,      // One party defaulted
        CANCELED        // Order canceled (Good-Til-Cancel - no expiry)
    }

    struct Order {
        uint256 id;
        address maker;
        address buyer;
        address seller;
        address projectToken;          // Expected token after TGE
        uint256 amount;
        uint256 unitPrice;             // in stable decimals
        uint256 buyerFunds;            // locked stable from buyer
        uint256 sellerCollateral;      // locked stable from seller
        uint64 settlementDeadline;     // TGE settlement deadline
        bool isSell;                   // maker sells project asset
        bool tokensDeposited;          // seller deposited tokens
        Status status;
        // Note: expiry removed - all orders are Good-Til-Cancel (GTC)
    }

    // Separate mapping for actual token addresses (saves space in Order struct)
    mapping(uint256 => address) public actualTokenAddress;
    
    // Track which projects have had TGE activated (prevents new orders after TGE)
    mapping(address => bool) public projectTgeActivated;
    
    // Proof submission for Points (off-chain settlement)
    mapping(uint256 => string) public settlementProof; // orderId => proof (tx hash, screenshot link, etc.)
    mapping(uint256 => uint64) public proofSubmittedAt; // orderId => timestamp

    IERC20 public immutable stable;
    uint8 public immutable stableDecimals;

    uint256 public nextId = 1;
    mapping(uint256 => Order) public orders;

    // Settlement configuration
    uint256 public constant DEFAULT_SETTLEMENT_WINDOW = 4 hours;
    uint256 public constant EXTENSION_4H = 4 hours;
    uint256 public constant EXTENSION_24H = 24 hours;
    
    // Risk management
    uint256 public constant MAX_ORDER_VALUE = 1_000_000 * 10**6; // 1M USDC max per order
    uint256 public constant MAX_PROOF_LENGTH = 500; // 500 characters max for proof strings

    // Events
    event OrderCreated(uint256 indexed id, address indexed maker, bool isSell, address projectToken, uint256 amount, uint256 unitPrice);
    event OrderFunded(uint256 indexed id, address buyer, address seller);
    event TGEActivated(uint256 indexed id, address tokenAddress, uint64 deadline);
    event SettlementExtended(uint256 indexed id, uint64 newDeadline, uint256 extensionHours);
    event TokensDeposited(uint256 indexed id, address seller, uint256 amount);
    event OrderSettled(uint256 indexed id, address buyer, address seller, uint256 totalPaid);
    event OrderCanceled(uint256 indexed id);
    event DefaultedToBuyer(uint256 indexed id, uint256 compensation);
    event DefaultedToSeller(uint256 indexed id, uint256 refund);
    event ManualSettlement(uint256 indexed id); // For Points
    event ProofSubmitted(uint256 indexed id, address seller, string proof); // Seller submits proof

    constructor(address stableToken) {
        require(stableToken != address(0), "STABLE_ZERO");
        stable = IERC20(stableToken);
        stableDecimals = IERC20(stableToken).decimals();
    }

    function _total(uint256 amount, uint256 unitPrice) internal pure returns (uint256) {
        // amount is in 18 decimals (token), unitPrice is in 6 decimals (stable)
        // We need to return the total in stable decimals (6)
        // So: (amount * unitPrice) / 10^18
        return (amount * unitPrice) / 1e18;
    }

    function _validate(uint256 amount, uint256 unitPrice) internal view {
        require(amount > 0, "AMOUNT");
        require(unitPrice > 0, "PRICE");
        
        // Check max order value to prevent fat-finger errors and DoS attacks
        // amount is in 18 decimals, unitPrice is in 6 decimals (stable)
        // So total is in 24 decimals, we need to convert to stable decimals (6)
        uint256 totalInStableDecimals = (amount * unitPrice) / 1e18;
        require(totalInStableDecimals <= MAX_ORDER_VALUE, "EXCEEDS_MAX_VALUE");
    }

    /// @notice Create a sell order (seller offers project tokens) - Good-Til-Cancel (GTC)
    function createSellOrder(uint256 amount, uint256 unitPrice, address projectToken)
        external whenNotPaused returns (uint256 id)
    {
        require(projectToken != address(0), "ZERO_PROJECT_TOKEN");
        require(!projectTgeActivated[projectToken], "TGE_ALREADY_ACTIVATED");
        _validate(amount, unitPrice);
        id = nextId++;
        Order storage o = orders[id];
        o.id = id;
        o.maker = msg.sender;
        o.seller = msg.sender;
        o.isSell = true;
        o.projectToken = projectToken;
        o.amount = amount;
        o.unitPrice = unitPrice;
        o.status = Status.OPEN;
        emit OrderCreated(id, msg.sender, true, projectToken, amount, unitPrice);
    }

    /// @notice Create a buy order (buyer wants project tokens) - Good-Til-Cancel (GTC)
    function createBuyOrder(uint256 amount, uint256 unitPrice, address projectToken)
        external whenNotPaused returns (uint256 id)
    {
        require(projectToken != address(0), "ZERO_PROJECT_TOKEN");
        require(!projectTgeActivated[projectToken], "TGE_ALREADY_ACTIVATED");
        _validate(amount, unitPrice);
        id = nextId++;
        Order storage o = orders[id];
        o.id = id;
        o.maker = msg.sender;
        o.buyer = msg.sender;
        o.isSell = false;
        o.projectToken = projectToken;
        o.amount = amount;
        o.unitPrice = unitPrice;
        o.status = Status.OPEN;
        emit OrderCreated(id, msg.sender, false, projectToken, amount, unitPrice);
    }

    /// @notice Seller deposits collateral (equal to trade value)
    function depositSellerCollateral(uint256 id) external nonReentrant whenNotPaused {
        Order storage o = orders[id];
        require(o.status == Status.OPEN, "NOT_OPEN");
        require(o.seller != address(0), "NO_SELLER");
        require(msg.sender == o.seller, "NOT_SELLER");
        require(o.sellerCollateral == 0, "ALREADY_DEPOSITED");

        uint256 total = _total(o.amount, o.unitPrice);
        o.sellerCollateral = total;

        require(stable.transferFrom(msg.sender, address(this), total), "TRANSFER_FAILED");

        // If buyer already funded, mark as FUNDED
        if (o.buyerFunds > 0) {
            o.status = Status.FUNDED;
            emit OrderFunded(id, o.buyer, o.seller);
        }
    }

    /// @notice Buyer deposits payment (full price)
    function depositBuyerFunds(uint256 id) external nonReentrant whenNotPaused {
        Order storage o = orders[id];
        require(o.status == Status.OPEN, "NOT_OPEN");
        require(o.buyer != address(0), "NO_BUYER");
        require(msg.sender == o.buyer, "NOT_BUYER");
        require(o.buyerFunds == 0, "ALREADY_DEPOSITED");

        uint256 total = _total(o.amount, o.unitPrice);
        o.buyerFunds = total;

        require(stable.transferFrom(msg.sender, address(this), total), "TRANSFER_FAILED");

        // If seller already funded, mark as FUNDED
        if (o.sellerCollateral > 0) {
            o.status = Status.FUNDED;
            emit OrderFunded(id, o.buyer, o.seller);
        }
    }

    /// @notice Buyer takes a sell order (becomes the buyer)
    function takeSellOrder(uint256 id) external whenNotPaused {
        Order storage o = orders[id];
        require(o.status == Status.OPEN, "NOT_OPEN");
        require(o.isSell, "NOT_SELL_ORDER");
        require(o.buyer == address(0), "ALREADY_TAKEN");
        require(msg.sender != o.seller, "CANT_TAKE_OWN");

        o.buyer = msg.sender;
    }

    /// @notice Seller takes a buy order (becomes the seller)
    function takeBuyOrder(uint256 id) external whenNotPaused {
        Order storage o = orders[id];
        require(o.status == Status.OPEN, "NOT_OPEN");
        require(!o.isSell, "NOT_BUY_ORDER");
        require(o.seller == address(0), "ALREADY_TAKEN");
        require(msg.sender != o.buyer, "CANT_TAKE_OWN");

        o.seller = msg.sender;
    }

    /// @notice Admin activates TGE and starts settlement countdown (for Tokens)
    function activateTGE(uint256 id, address actualToken) external onlyOwner {
        Order storage o = orders[id];
        require(o.status == Status.FUNDED, "NOT_FUNDED");
        require(actualToken != address(0), "ZERO_TOKEN");
        require(actualToken != address(stable), "CANT_BE_STABLE"); // Prevent confusion attack
        
        // Special placeholder address for off-chain settlement (Points projects)
        // Skip validation for the placeholder address
        bool isOffChainSettlement = actualToken == address(0x000000000000000000000000000000000000dEaD);
        
        if (!isOffChainSettlement) {
            // Validate it's a proper ERC20 token (only for on-chain settlement)
            try IERC20(actualToken).decimals() returns (uint8) {
                // Valid ERC20, continue
            } catch {
                revert("INVALID_TOKEN");
            }
        }

        // Mark project as TGE activated (prevents new orders)
        projectTgeActivated[o.projectToken] = true;

        actualTokenAddress[id] = actualToken;
        o.settlementDeadline = uint64(block.timestamp + DEFAULT_SETTLEMENT_WINDOW);
        o.status = Status.TGE_ACTIVATED;

        emit TGEActivated(id, actualToken, o.settlementDeadline);
    }

    /// @notice Admin activates TGE for ALL funded orders of a specific project token
    function batchActivateTGE(address projectToken, address actualToken) external onlyOwner {
        require(projectToken != address(0), "ZERO_PROJECT");
        require(actualToken != address(0), "ZERO_TOKEN");
        require(actualToken != address(stable), "CANT_BE_STABLE");
        
        // Special placeholder address for off-chain settlement (Points projects)
        // Skip validation for the placeholder address
        bool isOffChainSettlement = actualToken == address(0x000000000000000000000000000000000000dEaD);
        
        if (!isOffChainSettlement) {
            // Validate it's a proper ERC20 token (only for on-chain settlement)
            try IERC20(actualToken).decimals() returns (uint8) {
                // Valid ERC20, continue
            } catch {
                revert("INVALID_TOKEN");
            }
        }

        // Mark project as TGE activated (prevents new orders)
        projectTgeActivated[projectToken] = true;

        uint256 activatedCount = 0;
        uint64 deadline = uint64(block.timestamp + DEFAULT_SETTLEMENT_WINDOW);

        // Loop through all orders and activate those matching the project token
        for (uint256 i = 1; i < nextId; i++) {
            Order storage o = orders[i];
            
            // Only activate orders that:
            // 1. Match the project token
            // 2. Are in FUNDED status
            if (o.projectToken == projectToken && o.status == Status.FUNDED) {
                actualTokenAddress[i] = actualToken;
                o.settlementDeadline = deadline;
                o.status = Status.TGE_ACTIVATED;
                
                emit TGEActivated(i, actualToken, deadline);
                activatedCount++;
            }
        }

        require(activatedCount > 0, "NO_ORDERS_ACTIVATED");
    }

    /// @notice Admin extends settlement deadline by 4 or 24 hours
    function extendSettlement(uint256 id, uint256 extensionHours) external onlyOwner {
        Order storage o = orders[id];
        require(o.status == Status.TGE_ACTIVATED, "NOT_ACTIVATED");
        require(extensionHours == 4 || extensionHours == 24, "INVALID_HOURS");

        uint256 extension = extensionHours == 4 ? EXTENSION_4H : EXTENSION_24H;
        o.settlementDeadline = uint64(uint256(o.settlementDeadline) + extension);

        emit SettlementExtended(id, o.settlementDeadline, extensionHours);
    }

    /// @notice Seller deposits actual tokens for settlement
    function depositTokensForSettlement(uint256 id) external nonReentrant {
        Order storage o = orders[id];
        require(msg.sender == o.seller, "NOT_SELLER");
        require(!o.tokensDeposited, "ALREADY_DEPOSITED");
        require(o.status == Status.TGE_ACTIVATED, "NOT_ACTIVATED");
        require(block.timestamp <= o.settlementDeadline, "DEADLINE_PASSED");
        
        address tokenAddr = actualTokenAddress[id];
        require(tokenAddr != address(0), "NO_TOKEN_ADDRESS");

        IERC20 token = IERC20(tokenAddr);
        require(token.transferFrom(msg.sender, address(this), o.amount), "TOKEN_TRANSFER_FAILED");

        o.tokensDeposited = true;
        o.status = Status.TOKENS_DEPOSITED;

        emit TokensDeposited(id, msg.sender, o.amount);
    }

    /// @notice Buyer claims tokens after seller deposits
    function claimTokens(uint256 id) external nonReentrant whenNotPaused {
        Order storage o = orders[id];
        require(o.status == Status.TOKENS_DEPOSITED, "TOKENS_NOT_DEPOSITED");
        require(msg.sender == o.buyer, "NOT_BUYER");

        o.status = Status.SETTLED;

        // Transfer tokens to buyer
        address tokenAddr = actualTokenAddress[id];
        IERC20 token = IERC20(tokenAddr);
        require(token.transfer(o.buyer, o.amount), "TOKEN_TRANSFER_FAILED");

        // Transfer payment + collateral to seller
        uint256 total = o.buyerFunds + o.sellerCollateral;
        require(stable.transfer(o.seller, total), "STABLE_TRANSFER_FAILED");

        emit OrderSettled(id, o.buyer, o.seller, o.buyerFunds);
    }

    /// @notice Buyer defaults seller if they miss settlement deadline
    function defaultSeller(uint256 id) external nonReentrant whenNotPaused {
        Order storage o = orders[id];
        require(o.status == Status.TGE_ACTIVATED, "NOT_ACTIVATED");
        require(msg.sender == o.buyer, "NOT_BUYER");
        require(block.timestamp > o.settlementDeadline, "DEADLINE_NOT_PASSED");
        require(!o.tokensDeposited, "TOKENS_DEPOSITED");

        o.status = Status.DEFAULTED;

        // Buyer gets: their funds back + seller's collateral
        uint256 compensation = o.buyerFunds + o.sellerCollateral;
        require(stable.transfer(o.buyer, compensation), "TRANSFER_FAILED");

        emit DefaultedToBuyer(id, compensation);
    }

    /// @notice Seller submits proof of Points transfer (for off-chain settlement)
    function submitProof(uint256 id, string calldata proof) external {
        Order storage o = orders[id];
        require(o.status == Status.TGE_ACTIVATED, "NOT_IN_SETTLEMENT");
        require(msg.sender == o.seller, "NOT_SELLER");
        require(bytes(proof).length > 0, "EMPTY_PROOF");
        require(bytes(proof).length <= MAX_PROOF_LENGTH, "PROOF_TOO_LONG");

        settlementProof[id] = proof;
        proofSubmittedAt[id] = uint64(block.timestamp);

        emit ProofSubmitted(id, msg.sender, proof);
    }

    /// @notice Admin manually settles order (for Points - after verifying proof)
    function manualSettle(uint256 id) external onlyOwner nonReentrant {
        Order storage o = orders[id];
        require(o.status == Status.TGE_ACTIVATED, "NOT_IN_SETTLEMENT");
        require(bytes(settlementProof[id]).length > 0, "NO_PROOF_SUBMITTED");

        o.status = Status.SETTLED;

        // Seller gets: buyer's payment + their collateral back
        uint256 total = o.buyerFunds + o.sellerCollateral;
        require(stable.transfer(o.seller, total), "TRANSFER_FAILED");

        emit ManualSettlement(id);
        emit OrderSettled(id, o.buyer, o.seller, o.buyerFunds);
    }

    /// @notice Cancel unfunded order
    function cancel(uint256 id) external nonReentrant {
        Order storage o = orders[id];
        require(msg.sender == o.maker, "NOT_MAKER");
        require(o.status == Status.OPEN, "NOT_OPEN");
        
        // Can only cancel if not yet fully funded
        bool canCancel = (o.buyerFunds == 0) || (o.sellerCollateral == 0);
        require(canCancel, "ALREADY_FUNDED");

        // Refund any deposited funds BEFORE changing status (checks-effects-interactions)
        if (o.buyerFunds > 0) {
            uint256 refund = o.buyerFunds;
            o.buyerFunds = 0;
            require(stable.transfer(o.buyer, refund), "REFUND_FAILED");
        }
        if (o.sellerCollateral > 0) {
            uint256 refund = o.sellerCollateral;
            o.sellerCollateral = 0;
            require(stable.transfer(o.seller, refund), "REFUND_FAILED");
        }

        o.status = Status.CANCELED;
        emit OrderCanceled(id);
    }


    /// @notice View functions
    function getOrder(uint256 id) external view returns (Order memory) {
        return orders[id];
    }

    function getSettlementStatus(uint256 id) external view returns (
        bool tgeActivated,
        uint64 deadline,
        bool tokensDeposited,
        bool isOverdue
    ) {
        Order storage o = orders[id];
        tgeActivated = o.status == Status.TGE_ACTIVATED || o.status == Status.TOKENS_DEPOSITED;
        deadline = o.settlementDeadline;
        tokensDeposited = o.tokensDeposited;
        isOverdue = tgeActivated && !tokensDeposited && block.timestamp > deadline;
    }
}

