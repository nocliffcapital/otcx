// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {Ownable} from "solady/auth/Ownable.sol";
import {ReentrancyGuard} from "solady/utils/ReentrancyGuard.sol";

/**
 * @title EscrowOrderBookV4
 * @author otcX
 * @notice Pre-TGE OTC trading with collateralized escrow and fee system
 * @dev V4 improvements:
 *   - Project-level TGE activation (no loops, single flag per project)
 *   - Permissionless settlement (anyone can settle once TGE is active)
 *   - Fee system: 1% total (0.5% maker + 0.5% taker) + 0.1% cancellation
 *   - Split fee capture: 0.5% stable + 0.5% token for token projects
 */
contract EscrowOrderBookV4 is Ownable, ReentrancyGuard {
    // ========== TYPES ==========
    
    enum Status { 
        OPEN,           // Order created, awaiting counterparty
        FUNDED,         // Both parties locked collateral
        SETTLED,        // Complete - tokens delivered
        DEFAULTED,      // One party defaulted
        CANCELED        // Order canceled
    }

    struct Order {
        uint256 id;
        address maker;
        address buyer;
        address seller;
        bytes32 projectId;             // keccak256(slug)
        uint256 amount;                // Token amount (18 decimals)
        uint256 unitPrice;             // Price per token (stable decimals)
        uint256 buyerFunds;            // Locked stable from buyer
        uint256 sellerCollateral;      // Locked stable from seller
        uint64 createdAt;              // Timestamp when order was created
        bool isSell;                   // true = maker sells, false = maker buys
        Status status;
    }

    // ========== STATE VARIABLES ==========
    
    // Immutable
    IERC20 public immutable stable;
    uint8 public immutable stableDecimals;
    address public immutable feeCollector;
    
    // Fee Configuration (adjustable by owner)
    uint64 public settlementFeeBps = 50;        // 0.5% commission fee (split between stable + token)
    uint64 public cancellationFeeBps = 10;      // 0.1% cancellation fee
    
    // Constants (gas optimization)
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MAX_FEE_BPS = 500;              // 5% max
    uint256 public constant DEFAULT_SETTLEMENT_WINDOW = 4 hours;
    uint256 public constant MAX_ORDER_VALUE = 1_000_000 * 10**6; // 1M USDC
    
    // Mutable
    uint256 public nextId = 1;
    mapping(uint256 => Order) public orders;
    bool public paused;
    
    // Project-level TGE management (V4: no per-order tracking!)
    mapping(bytes32 => bool) public projectTgeActivated;
    mapping(bytes32 => address) public projectTokenAddress;
    mapping(bytes32 => uint64) public projectSettlementDeadline;
    
    // Points projects: proof submission
    mapping(uint256 => string) public settlementProof;
    mapping(uint256 => uint64) public proofSubmittedAt;

    // ========== EVENTS ==========
    
    event OrderCreated(uint256 indexed id, address indexed maker, bool isSell, bytes32 indexed projectId, uint256 amount, uint256 unitPrice);
    event OrderFunded(uint256 indexed id, address buyer, address seller);
    event ProjectTGEActivated(bytes32 indexed projectId, address tokenAddress, uint64 deadline);
    event OrderSettled(uint256 indexed id, address buyer, address seller, uint256 stableFee, uint256 tokenFee);
    event OrderCanceled(uint256 indexed id, uint256 fee);
    event OrderDefaulted(uint256 indexed id, address compensated, uint256 amount);
    event ProofSubmitted(uint256 indexed id, address seller, string proof);
    event SettlementExtended(bytes32 indexed projectId, uint64 newDeadline);
    event FeeCollected(bytes32 indexed projectId, address token, uint256 amount);
    event FeeUpdated(string feeType, uint64 oldRate, uint64 newRate);
    event Paused(address indexed account);
    event Unpaused(address indexed account);

    // ========== ERRORS ==========
    
    error ContractPaused();
    error ContractNotPaused();
    error NotAuthorized();
    error InvalidAmount();
    error InvalidPrice();
    error InvalidAddress();
    error OrderNotFound();
    error InvalidStatus();
    error TGENotActivated();
    error TGEAlreadyActivated();
    error DeadlinePassed();
    error InsufficientBalance();
    error TransferFailed();
    error ExceedsMaxValue();
    error FeeTooHigh();

    // ========== MODIFIERS ==========
    
    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    modifier whenPaused() {
        if (!paused) revert ContractNotPaused();
        _;
    }

    // ========== CONSTRUCTOR ==========
    
    constructor(address stableToken, address _feeCollector) {
        if (stableToken == address(0) || _feeCollector == address(0)) revert InvalidAddress();
        
        stable = IERC20(stableToken);
        stableDecimals = IERC20(stableToken).decimals();
        feeCollector = _feeCollector;
        
        _initializeOwner(msg.sender);
    }

    // ========== ADMIN FUNCTIONS ==========
    
    /// @notice Pause the contract
    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    /// @notice Unpause the contract
    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    /// @notice Update the settlement fee rate
    /// @param newFeeBps New fee in basis points (50 = 0.5%)
    function setSettlementFee(uint64 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        uint64 oldFee = settlementFeeBps;
        settlementFeeBps = newFeeBps;
        emit FeeUpdated("settlement", oldFee, newFeeBps);
    }

    /// @notice Update the cancellation fee rate
    /// @param newFeeBps New fee in basis points (10 = 0.1%)
    function setCancellationFee(uint64 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        uint64 oldFee = cancellationFeeBps;
        cancellationFeeBps = newFeeBps;
        emit FeeUpdated("cancellation", oldFee, newFeeBps);
    }

    /// @notice Activate TGE for a project (V4: project-level, not per-order!)
    /// @param projectId The project identifier (keccak256 of slug)
    /// @param tokenAddress The actual token address (or 0xdead for Points)
    function activateProjectTGE(
        bytes32 projectId,
        address tokenAddress
    ) external onlyOwner {
        if (projectTgeActivated[projectId]) revert TGEAlreadyActivated();
        if (tokenAddress == address(0)) revert InvalidAddress();
        if (tokenAddress == address(stable)) revert InvalidAddress();
        
        // For Points projects, allow placeholder
        bool isPointsProject = (tokenAddress == 0x000000000000000000000000000000000000dEaD);
        
        if (!isPointsProject) {
            // Validate it's a real ERC20
            try IERC20(tokenAddress).totalSupply() returns (uint256) {
                // Valid token
            } catch {
                revert InvalidAddress();
            }
        }
        
        projectTgeActivated[projectId] = true;
        projectTokenAddress[projectId] = tokenAddress;
        projectSettlementDeadline[projectId] = uint64(block.timestamp + DEFAULT_SETTLEMENT_WINDOW);
        
        emit ProjectTGEActivated(projectId, tokenAddress, projectSettlementDeadline[projectId]);
    }

    /// @notice Extend settlement deadline for a project
    /// @param projectId The project identifier
    /// @param extensionHours Hours to extend (4 or 24)
    function extendSettlementDeadline(
        bytes32 projectId,
        uint256 extensionHours
    ) external onlyOwner {
        if (!projectTgeActivated[projectId]) revert TGENotActivated();
        if (extensionHours != 4 && extensionHours != 24) revert InvalidAmount();
        
        uint64 extension = uint64(extensionHours * 1 hours);
        projectSettlementDeadline[projectId] += extension;
        
        emit SettlementExtended(projectId, projectSettlementDeadline[projectId]);
    }

    // ========== CORE TRADING FUNCTIONS ==========
    
    /// @notice Create a new order
    /// @param projectId The project identifier
    /// @param amount Token amount to trade
    /// @param unitPrice Price per token in stable
    /// @param isSell True if selling, false if buying
    function createOrder(
        bytes32 projectId,
        uint256 amount,
        uint256 unitPrice,
        bool isSell
    ) external nonReentrant whenNotPaused returns (uint256) {
        if (amount == 0) revert InvalidAmount();
        if (unitPrice == 0) revert InvalidPrice();
        if (projectTgeActivated[projectId]) revert TGEAlreadyActivated();
        
        // Calculate values
        uint256 totalValue = (amount * unitPrice) / 1e18;
        if (totalValue > MAX_ORDER_VALUE) revert ExceedsMaxValue();
        
        // Collateral requirement
        uint256 collateral = isSell 
            ? (totalValue * 110) / 100  // Seller: 110% collateral
            : totalValue;               // Buyer: 100% (payment)
        
        // Transfer collateral
        if (!stable.transferFrom(msg.sender, address(this), collateral)) revert TransferFailed();
        
        uint256 orderId = nextId++;
        
        orders[orderId] = Order({
            id: orderId,
            maker: msg.sender,
            buyer: isSell ? address(0) : msg.sender,
            seller: isSell ? msg.sender : address(0),
            projectId: projectId,
            amount: amount,
            unitPrice: unitPrice,
            buyerFunds: isSell ? 0 : collateral,
            sellerCollateral: isSell ? collateral : 0,
            createdAt: uint64(block.timestamp),
            isSell: isSell,
            status: Status.OPEN
        });
        
        emit OrderCreated(orderId, msg.sender, isSell, projectId, amount, unitPrice);
        
        return orderId;
    }

    /// @notice Take an existing order (combined take + deposit)
    /// @param orderId The order to take
    function takeOrder(uint256 orderId) external nonReentrant whenNotPaused {
        Order storage order = orders[orderId];
        if (order.status != Status.OPEN) revert InvalidStatus();
        if (order.maker == msg.sender) revert NotAuthorized();
        if (projectTgeActivated[order.projectId]) revert TGEAlreadyActivated();
        
        uint256 totalValue = (order.amount * order.unitPrice) / 1e18;
        uint256 collateral = order.isSell 
            ? totalValue                 // Buyer pays purchase price
            : (totalValue * 110) / 100;  // Seller posts 110% collateral
        
        // Transfer collateral from taker
        if (!stable.transferFrom(msg.sender, address(this), collateral)) revert TransferFailed();
        
        // Update order state
        if (order.isSell) {
            order.buyer = msg.sender;
            order.buyerFunds = collateral;
        } else {
            order.seller = msg.sender;
            order.sellerCollateral = collateral;
        }
        
        order.status = Status.FUNDED;
        
        emit OrderFunded(orderId, order.buyer, order.seller);
    }

    /// @notice Cancel an order (with fee)
    /// @param orderId The order to cancel
    function cancelOrder(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        if (order.maker != msg.sender) revert NotAuthorized();
        if (order.status != Status.OPEN && order.status != Status.FUNDED) revert InvalidStatus();
        
        uint256 cancellationFee = 0;
        uint256 refund;
        uint256 counterpartyRefund;
        address counterparty;
        
        // Calculate fee based on state
        if (order.status == Status.OPEN) {
            // No counterparty yet - always charge cancellation fee
            refund = order.isSell ? order.sellerCollateral : order.buyerFunds;
            
            uint256 orderValue = (order.amount * order.unitPrice) / 1e18;
            cancellationFee = (orderValue * cancellationFeeBps) / BPS_DENOMINATOR;
            if (cancellationFee > refund) cancellationFee = 0; // Safety check
        } else if (order.status == Status.FUNDED) {
            // Counterparty already locked - return their collateral, charge maker fee
            uint256 orderValue = (order.amount * order.unitPrice) / 1e18;
            cancellationFee = (orderValue * cancellationFeeBps) / BPS_DENOMINATOR;
            
            // Prepare counterparty refund
            if (order.isSell) {
                counterparty = order.buyer;
                counterpartyRefund = order.buyerFunds;
                refund = order.sellerCollateral;
            } else {
                counterparty = order.seller;
                counterpartyRefund = order.sellerCollateral;
                refund = order.buyerFunds;
            }
            
            if (cancellationFee > refund) cancellationFee = 0;
        }
        
        // EFFECTS: Update state before interactions
        order.status = Status.CANCELED;
        
        // INTERACTIONS: External calls
        // Return counterparty's collateral if FUNDED
        if (counterpartyRefund > 0) {
            if (!stable.transfer(counterparty, counterpartyRefund)) revert TransferFailed();
        }
        
        // Refund maker minus fee
        uint256 netRefund = refund - cancellationFee;
        if (netRefund > 0) {
            if (!stable.transfer(msg.sender, netRefund)) revert TransferFailed();
        }
        
        // Collect fee
        if (cancellationFee > 0) {
            if (!stable.transfer(feeCollector, cancellationFee)) revert TransferFailed();
            emit FeeCollected(order.projectId, address(stable), cancellationFee);
        }
        
        emit OrderCanceled(orderId, cancellationFee);
    }

    /// @notice Settle an order (V4: permissionless - anyone can call!)
    /// @param orderId The order to settle
    function settleOrder(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        if (order.status != Status.FUNDED) revert InvalidStatus();
        if (!projectTgeActivated[order.projectId]) revert TGENotActivated();
        if (block.timestamp > projectSettlementDeadline[order.projectId]) revert DeadlinePassed();
        
        address tokenAddress = projectTokenAddress[order.projectId];
        bool isPointsProject = (tokenAddress == 0x000000000000000000000000000000000000dEaD);
        
        if (isPointsProject) {
            // Points: cannot auto-settle, requires manual admin settlement
            revert InvalidStatus();
        }
        
        // Calculate fees: 0.5% stable + 0.5% token
        uint256 stableFee = (order.buyerFunds * settlementFeeBps) / BPS_DENOMINATOR;
        uint256 tokenFee = (order.amount * settlementFeeBps) / BPS_DENOMINATOR;
        
        // Cache values before state change
        address buyer = order.buyer;
        address seller = order.seller;
        bytes32 projectId = order.projectId;
        uint256 totalToSeller = order.buyerFunds + order.sellerCollateral - stableFee;
        
        // EFFECTS: Update state before interactions
        order.status = Status.SETTLED;
        
        // INTERACTIONS: External calls
        // Seller must deposit tokens
        if (!IERC20(tokenAddress).transferFrom(seller, address(this), order.amount)) revert TransferFailed();
        
        // Transfer tokens to buyer (minus fee)
        if (!IERC20(tokenAddress).transfer(buyer, order.amount - tokenFee)) revert TransferFailed();
        
        // Transfer stable to seller (minus fee) + return seller collateral
        if (!stable.transfer(seller, totalToSeller)) revert TransferFailed();
        
        // Collect fees
        if (!IERC20(tokenAddress).transfer(feeCollector, tokenFee)) revert TransferFailed();
        if (!stable.transfer(feeCollector, stableFee)) revert TransferFailed();
        
        emit OrderSettled(orderId, buyer, seller, stableFee, tokenFee);
        emit FeeCollected(projectId, address(stable), stableFee);
        emit FeeCollected(projectId, tokenAddress, tokenFee);
    }

    /// @notice Submit proof for Points project settlement
    /// @param orderId The order ID
    /// @param proof IPFS hash or transaction proof
    function submitProof(uint256 orderId, string calldata proof) external {
        Order storage order = orders[orderId];
        if (order.seller != msg.sender) revert NotAuthorized();
        if (order.status != Status.FUNDED) revert InvalidStatus();
        if (!projectTgeActivated[order.projectId]) revert TGENotActivated();
        
        settlementProof[orderId] = proof;
        proofSubmittedAt[orderId] = uint64(block.timestamp);
        
        emit ProofSubmitted(orderId, msg.sender, proof);
    }

    /// @notice Admin manually settles Points project order after verifying proof
    /// @param orderId The order to settle
    function settleOrderManual(uint256 orderId) external onlyOwner nonReentrant {
        Order storage order = orders[orderId];
        if (order.status != Status.FUNDED) revert InvalidStatus();
        if (!projectTgeActivated[order.projectId]) revert TGENotActivated();
        if (bytes(settlementProof[orderId]).length == 0) revert InvalidStatus();
        
        // Calculate fee: 0.5% of total collateral (no token to capture for Points)
        uint256 totalCollateral = order.buyerFunds + order.sellerCollateral;
        uint256 fee = (totalCollateral * settlementFeeBps) / BPS_DENOMINATOR;
        uint256 netToSeller = totalCollateral - fee;
        
        // Cache values before state change
        address buyer = order.buyer;
        address seller = order.seller;
        bytes32 projectId = order.projectId;
        
        // EFFECTS: Update state before interactions
        order.status = Status.SETTLED;
        
        // INTERACTIONS: External calls
        // Distribute collateral minus fee
        if (!stable.transfer(seller, netToSeller)) revert TransferFailed();
        
        // Collect fee
        if (fee > 0) {
            if (!stable.transfer(feeCollector, fee)) revert TransferFailed();
            emit FeeCollected(projectId, address(stable), fee);
        }
        
        emit OrderSettled(orderId, buyer, seller, fee, 0);
    }

    /// @notice Handle defaulted order (after deadline)
    /// @param orderId The order that defaulted
    function handleDefault(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        if (order.status != Status.FUNDED) revert InvalidStatus();
        if (!projectTgeActivated[order.projectId]) revert TGENotActivated();
        if (block.timestamp <= projectSettlementDeadline[order.projectId]) revert InvalidStatus();
        
        // Calculate compensation and cache values
        uint256 compensation = order.buyerFunds + order.sellerCollateral;
        address buyer = order.buyer;
        
        // EFFECTS: Update state before interactions
        order.status = Status.DEFAULTED;
        
        // INTERACTIONS: External call
        // Refund buyer (seller defaulted)
        if (!stable.transfer(buyer, compensation)) revert TransferFailed();
        
        emit OrderDefaulted(orderId, buyer, compensation);
    }
}

