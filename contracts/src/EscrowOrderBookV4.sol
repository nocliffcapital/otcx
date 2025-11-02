// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {Ownable} from "solady/auth/Ownable.sol";
import {ReentrancyGuard} from "solady/utils/ReentrancyGuard.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";

/**
 * @notice Minimal interface for ProjectRegistryV2
 */
interface IProjectRegistry {
    function isActive(bytes32 projectId) external view returns (bool);
}

/**
 * @title EscrowOrderBookV4
 * @author otcX
 * @notice Pre-TGE OTC trading with collateralized escrow and fee system
 * @dev V4 improvements:
 *   - Project-level TGE activation (no loops, single flag per project)
 *   - Permissionless settlement (anyone can settle once TGE is active)
 *   - Fee system: 0.5% settlement + 0.1% cancellation (configurable 0-5%)
 *   - Split fee capture: 0.5% stable + 0.5% token for token projects
 *   - Rounding policy: All fee calculations use floor division (round down)
 *   - Token requirements: Only 18-decimal ERC20 tokens supported
 *   - SafeTransferLib: Robust handling of non-standard ERC20 tokens
 * 
 * @dev Conversion Ratio Design:
 *   - Stored at project level (projectConversionRatio)
 *   - Applies to ALL orders when settlement occurs
 *   - For Points: Can be any positive value (e.g., 1.2e18 = 1 point → 1.2 tokens)
 *   - For Tokens: Must be exactly 1e18 (1:1 ratio enforced)
 *   - Grace period: 1 hour after TGE activation to correct mistakes
 *   - Max ratio: 10e18 (1 point = max 10 tokens)
 */
contract EscrowOrderBookV4 is Ownable, ReentrancyGuard {
    using SafeTransferLib for address;
    
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
        address allowedTaker;          // address(0) = public, specific address = private
        Status status;
    }

    // ========== STATE VARIABLES ==========
    
    // Immutable
    IERC20 public immutable stable;
    uint8 public immutable stableDecimals;
    address public immutable feeCollector;
    IProjectRegistry public immutable registry;
    uint256 public immutable maxOrderValue;                 // 1M in stable decimals
    
    // Mutable limits
    uint256 public minOrderValue;                           // Default $100 in stable decimals
    
    // Fee Configuration (adjustable by owner)
    uint64 public settlementFeeBps = 50;        // 0.5% commission fee (split between stable + token)
    uint64 public cancellationFeeBps = 10;      // 0.1% cancellation fee
    
    // Constants (gas optimization)
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MAX_FEE_BPS = 500;              // 5% max
    uint256 public constant DEFAULT_SETTLEMENT_WINDOW = 4 hours;
    uint256 public constant MAX_SETTLEMENT_WINDOW = 7 days;
    // Use computed address for POINTS_SENTINEL (impossible to deploy to, collision-resistant)
    address public constant POINTS_SENTINEL = address(uint160(uint256(keccak256("otcX.POINTS_SENTINEL.v4"))));
    
    // Mutable
    uint256 public nextId = 1;
    mapping(uint256 => Order) public orders;
    bool public paused;
    
    // Project-level TGE management (V4: no per-order tracking!)
    mapping(bytes32 => bool) public projectTgeActivated;
    mapping(bytes32 => address) public projectTokenAddress;
    mapping(bytes32 => uint64) public projectSettlementDeadline;
    mapping(bytes32 => uint256) public projectConversionRatio; // Points to tokens ratio (18 decimals, e.g., 1.2e18 = 1 point = 1.2 tokens)
    mapping(bytes32 => uint64) public projectTgeActivatedAt; // Timestamp of TGE activation (for grace period)
    
    // Points projects: proof submission
    mapping(uint256 => string) public settlementProof;
    mapping(uint256 => uint64) public proofSubmittedAt;
    
    // Points projects: proof acceptance (owner must explicitly approve before settlement)
    mapping(uint256 => bool) public proofAccepted;
    mapping(uint256 => uint64) public proofAcceptedAt;
    
    // Points projects: proof rejection tracking (for default handling)
    mapping(uint256 => bool) public proofRejected;

    // ========== EVENTS ==========
    
    event OrderCreated(uint256 indexed id, address indexed maker, bool isSell, bytes32 indexed projectId, uint256 amount, uint256 unitPrice);
    event OrderFunded(uint256 indexed id, address buyer, address seller);
    event ProjectTGEActivated(bytes32 indexed projectId, address tokenAddress, uint64 deadline, uint256 conversionRatio);
    event OrderSettled(uint256 indexed id, address buyer, address seller, uint256 stableFee, uint256 tokenFee);
    event OrderCanceled(uint256 indexed id, uint256 fee);
    event OrderDefaulted(uint256 indexed id, address compensated, uint256 amount);
    event ProofSubmitted(uint256 indexed id, address seller, string proof);
    event ProofAccepted(uint256 indexed id, address indexed admin);
    event ProofRejected(uint256 indexed id, address indexed admin, string reason);
    event SettlementExtended(bytes32 indexed projectId, uint64 newDeadline);
    event FeeCollected(bytes32 indexed projectId, address token, uint256 amount);
    event SettlementFeeUpdated(uint64 oldRate, uint64 newRate);
    event CancellationFeeUpdated(uint64 oldRate, uint64 newRate);
    event ConversionRatioUpdated(bytes32 indexed projectId, uint256 oldRatio, uint256 newRatio);
    event MinOrderValueUpdated(uint256 oldValue, uint256 newValue);
    event Paused(address indexed account);
    event Unpaused(address indexed account);

    // ========== ERRORS ==========
    
    error ContractPaused();
    error ContractNotPaused();
    error NotAuthorized();
    error InvalidAmount();
    error InvalidPrice();
    error InvalidAddress();
    error InvalidProject();
    error OrderNotFound();
    error InvalidStatus();
    error TGENotActivated();
    error TGEAlreadyActivated();
    error DeadlinePassed();
    error InsufficientBalance();
    error TransferFailed();
    error ExceedsMaxValue();
    error FeeTooHigh();
    error GracePeriodExpired();
    error OrderValueTooLow();

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
    
    constructor(address stableToken, address _feeCollector, address _registry) {
        if (stableToken == address(0) || _feeCollector == address(0) || _registry == address(0)) revert InvalidAddress();
        
        stable = IERC20(stableToken);
        stableDecimals = IERC20(stableToken).decimals();
        feeCollector = _feeCollector;
        registry = IProjectRegistry(_registry);
        maxOrderValue = 1_000_000 * (10 ** stableDecimals);  // 1M in stable decimals
        minOrderValue = 100 * (10 ** stableDecimals);        // $100 minimum (prevents zero-fee dust orders)
        
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
        emit SettlementFeeUpdated(oldFee, newFeeBps);
    }

    /// @notice Update the cancellation fee rate
    /// @param newFeeBps New fee in basis points (10 = 0.1%)
    function setCancellationFee(uint64 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        uint64 oldFee = cancellationFeeBps;
        cancellationFeeBps = newFeeBps;
        emit CancellationFeeUpdated(oldFee, newFeeBps);
    }

    /// @notice Update the minimum order value
    /// @param newMinValue New minimum order value in stable decimals (e.g., 100 * 1e6 for $100 USDC)
    function setMinOrderValue(uint256 newMinValue) external onlyOwner {
        if (newMinValue == 0) revert InvalidAmount();
        if (newMinValue > maxOrderValue) revert InvalidAmount();
        uint256 oldValue = minOrderValue;
        minOrderValue = newMinValue;
        emit MinOrderValueUpdated(oldValue, newMinValue);
    }

    /// @notice Activate TGE for a project (V4: project-level activation)
    /// @param projectId The project identifier (keccak256 of slug)
    /// @param tokenAddress Token address (or POINTS_SENTINEL for points projects)
    /// @param settlementWindow Settlement window in seconds (max 7 days)
    /// @param conversionRatio For points: ratio of points to tokens (18 decimals, e.g., 1.2e18 = 1 point = 1.2 tokens). For tokens: must be 1e18 (1:1)
    function activateProjectTGE(
        bytes32 projectId,
        address tokenAddress,
        uint64 settlementWindow,
        uint256 conversionRatio
    ) external onlyOwner {
        if (projectTgeActivated[projectId]) revert TGEAlreadyActivated();
        if (tokenAddress == address(0)) revert InvalidAddress();
        if (tokenAddress == address(stable)) revert InvalidAddress();
        if (settlementWindow == 0 || settlementWindow > MAX_SETTLEMENT_WINDOW) revert InvalidAmount();
        if (conversionRatio == 0) revert InvalidAmount();
        
        // For Points projects, allow sentinel
        bool isPointsProject = (tokenAddress == POINTS_SENTINEL);
        
        if (!isPointsProject) {
            // Validate it's a real ERC20 with code
            if (tokenAddress.code.length == 0) revert InvalidAddress();
            
            // Validate totalSupply() exists and is non-zero
            try IERC20(tokenAddress).totalSupply() returns (uint256 supply) {
                if (supply == 0) revert InvalidAddress();  // Token must have supply
            } catch {
                revert InvalidAddress();
            }
            
            // Enforce 18 decimals for tokens (prevents amount/fee calculation errors)
            try IERC20(tokenAddress).decimals() returns (uint8 decimals) {
                if (decimals != 18) revert InvalidAddress();  // Only 18-decimal tokens supported
            } catch {
                revert InvalidAddress();
            }
            
            // For token projects, conversion ratio must be 1:1 (1e18)
            if (conversionRatio != 1e18) revert InvalidAmount();
        }
        
        projectTgeActivated[projectId] = true;
        projectTokenAddress[projectId] = tokenAddress;
        projectSettlementDeadline[projectId] = uint64(block.timestamp + settlementWindow);
        projectConversionRatio[projectId] = conversionRatio;
        projectTgeActivatedAt[projectId] = uint64(block.timestamp);
        
        emit ProjectTGEActivated(projectId, tokenAddress, projectSettlementDeadline[projectId], conversionRatio);
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
        
        // Prevent extending after deadline (defaults should be final)
        if (block.timestamp > projectSettlementDeadline[projectId]) revert DeadlinePassed();
        
        uint64 extension = uint64(extensionHours * 1 hours);
        projectSettlementDeadline[projectId] += extension;
        
        emit SettlementExtended(projectId, projectSettlementDeadline[projectId]);
    }

    /// @notice Emergency update conversion ratio within 1 hour grace period
    /// @param projectId The project identifier
    /// @param newRatio New conversion ratio
    /// @dev Can only be called within 1 hour of TGE activation, before any settlements
    function updateConversionRatio(
        bytes32 projectId,
        uint256 newRatio
    ) external onlyOwner {
        if (!projectTgeActivated[projectId]) revert TGENotActivated();
        if (newRatio == 0) revert InvalidAmount();
        
        // Only allow updates within 1 hour grace period
        if (block.timestamp > projectTgeActivatedAt[projectId] + 1 hours) revert GracePeriodExpired();
        
        // Validate token project ratio
        address tokenAddress = projectTokenAddress[projectId];
        bool isPointsProject = (tokenAddress == POINTS_SENTINEL);
        if (!isPointsProject && newRatio != 1e18) revert InvalidAmount();
        
        uint256 oldRatio = projectConversionRatio[projectId];
        projectConversionRatio[projectId] = newRatio;
        
        emit ConversionRatioUpdated(projectId, oldRatio, newRatio);
    }

    // ========== VIEW / PURE HELPERS ==========
    
    /// @notice Get conversion ratio for a project (returns 1e18 if not set)
    /// @param projectId The project identifier
    /// @return ratio The conversion ratio (1e18 = 1:1)
    function getConversionRatio(bytes32 projectId) external view returns (uint256) {
        uint256 ratio = projectConversionRatio[projectId];
        return ratio == 0 ? 1e18 : ratio;
    }
    
    /// @notice Calculate total order value in stable
    /// @param amount Token amount (18 decimals)
    /// @param unitPrice Price per token (stable decimals)
    /// @return totalValue Order value in stable
    function quoteTotalValue(uint256 amount, uint256 unitPrice) public pure returns (uint256) {
        return (amount * unitPrice) / 1e18;
    }
    
    /// @notice Calculate seller collateral requirement (100% of value)
    /// @param totalValue Order value in stable
    /// @return collateral Required seller collateral
    function quoteSellerCollateral(uint256 totalValue) public pure returns (uint256) {
        return totalValue;
    }
    
    /// @notice Get order value for an existing order
    /// @param orderId The order ID
    /// @return value Order value in stable
    function getOrderValue(uint256 orderId) external view returns (uint256) {
        Order storage order = orders[orderId];
        return quoteTotalValue(order.amount, order.unitPrice);
    }
    
    // ========== CORE TRADING FUNCTIONS ==========
    
    /// @notice Create a new order
    /// @dev createOrder and takeOrder: require whenNotPaused
    /// @dev cancel, settle, handleDefault: remain callable when paused (allow exits)
    /// @param projectId The project identifier
    /// @param amount Token amount to trade
    /// @param unitPrice Price per token in stable
    /// @param isSell True if selling, false if buying
    /// @param allowedTaker Address allowed to take order (address(0) = public order, anyone can take)
    function createOrder(
        bytes32 projectId,
        uint256 amount,
        uint256 unitPrice,
        bool isSell,
        address allowedTaker
    ) external nonReentrant whenNotPaused returns (uint256) {
        if (amount == 0) revert InvalidAmount();
        if (unitPrice == 0) revert InvalidPrice();
        if (projectTgeActivated[projectId]) revert TGEAlreadyActivated();
        
        // Validate project exists and is active in Registry
        if (!registry.isActive(projectId)) revert InvalidProject();
        
        // Calculate values
        uint256 totalValue = (amount * unitPrice) / 1e18;
        if (totalValue > maxOrderValue) revert ExceedsMaxValue();
        if (totalValue < minOrderValue) revert OrderValueTooLow();
        
        // Collateral requirement
        uint256 collateral = totalValue;  // Both parties: 100% collateral
        
        // Transfer collateral (with balance-delta check to prevent fee-on-transfer token issues)
        uint256 balBefore = stable.balanceOf(address(this));
        address(stable).safeTransferFrom(msg.sender, address(this), collateral);
        uint256 balAfter = stable.balanceOf(address(this));
        if (balAfter - balBefore != collateral) revert InvalidAmount();
        
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
            allowedTaker: allowedTaker,
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
        
        // Check if order is private (only specific address can take)
        if (order.allowedTaker != address(0) && order.allowedTaker != msg.sender) {
            revert NotAuthorized();
        }
        
        uint256 totalValue = (order.amount * order.unitPrice) / 1e18;
        uint256 collateral = totalValue;  // Both sides post 100% collateral
        
        // Transfer collateral from taker (with balance-delta check to prevent fee-on-transfer token issues)
        uint256 balBefore = stable.balanceOf(address(this));
        address(stable).safeTransferFrom(msg.sender, address(this), collateral);
        uint256 balAfter = stable.balanceOf(address(this));
        if (balAfter - balBefore != collateral) revert InvalidAmount();
        
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
        
        // Prevent cancellation after proof is accepted (prevents rugpull on Points projects)
        // Seller may have already delivered tokens off-chain once admin accepted proof
        if (proofAccepted[orderId]) revert InvalidStatus();
        
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
            address(stable).safeTransfer(counterparty, counterpartyRefund);
        }
        
        // Refund maker minus fee
        uint256 netRefund = refund - cancellationFee;
        if (netRefund > 0) {
            address(stable).safeTransfer(msg.sender, netRefund);
        }
        
        // Collect fee
        if (cancellationFee > 0) {
            address(stable).safeTransfer(feeCollector, cancellationFee);
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
        bool isPointsProject = (tokenAddress == POINTS_SENTINEL);
        
        if (isPointsProject) {
            // Points: cannot auto-settle, requires manual admin settlement
            revert InvalidStatus();
        }
        
        // Apply conversion ratio (for token projects, this is always 1e18 = 1:1)
        uint256 conversionRatio = projectConversionRatio[order.projectId];
        if (conversionRatio == 0) conversionRatio = 1e18; // Default to 1:1 if not set (safety)
        uint256 actualTokenAmount = (order.amount * conversionRatio) / 1e18;
        
        // Calculate fees: 0.5% stable + 0.5% token (on actual token amount)
        uint256 stableFee = (order.buyerFunds * settlementFeeBps) / BPS_DENOMINATOR;
        uint256 tokenFee = (actualTokenAmount * settlementFeeBps) / BPS_DENOMINATOR;
        
        // Cache values before state change
        address buyer = order.buyer;
        address seller = order.seller;
        bytes32 projectId = order.projectId;
        uint256 totalToSeller = order.buyerFunds + order.sellerCollateral - stableFee;
        
        // EFFECTS: Update state before interactions
        order.status = Status.SETTLED;
        
        // INTERACTIONS: External calls
        // Seller must deposit actual token amount (with balance-delta check to prevent fee-on-transfer token issues)
        uint256 tokenBalBefore = IERC20(tokenAddress).balanceOf(address(this));
        tokenAddress.safeTransferFrom(seller, address(this), actualTokenAmount);
        uint256 tokenBalAfter = IERC20(tokenAddress).balanceOf(address(this));
        if (tokenBalAfter - tokenBalBefore != actualTokenAmount) revert InvalidAmount();
        
        // Transfer tokens to buyer (minus fee)
        tokenAddress.safeTransfer(buyer, actualTokenAmount - tokenFee);
        
        // Transfer stable to seller (minus fee) + return seller collateral
        address(stable).safeTransfer(seller, totalToSeller);
        
        // Collect fees
        tokenAddress.safeTransfer(feeCollector, tokenFee);
        address(stable).safeTransfer(feeCollector, stableFee);
        
        emit OrderSettled(orderId, buyer, seller, stableFee, tokenFee);
        emit FeeCollected(projectId, address(stable), stableFee);
        emit FeeCollected(projectId, tokenAddress, tokenFee);
    }

    /// @notice Submit proof for Points project settlement
    /// @param orderId The order ID
    /// @param proof IPFS hash or transaction proof
    /// @dev Proof must be submitted before settlement deadline to prevent griefing
    function submitProof(uint256 orderId, string calldata proof) external {
        Order storage order = orders[orderId];
        if (order.seller != msg.sender) revert NotAuthorized();
        if (order.status != Status.FUNDED) revert InvalidStatus();
        if (!projectTgeActivated[order.projectId]) revert TGENotActivated();
        
        // Only allow proof submission before settlement deadline (prevents griefing)
        if (block.timestamp > projectSettlementDeadline[order.projectId]) {
            revert DeadlinePassed();
        }
        
        settlementProof[orderId] = proof;
        proofSubmittedAt[orderId] = uint64(block.timestamp);
        
        emit ProofSubmitted(orderId, msg.sender, proof);
    }

    /// @notice Owner accepts the seller's proof for a Points order
    /// @param orderId The order ID
    /// @dev Acceptance must occur AFTER the settlement deadline (users have exactly 4 hours to submit)
    function acceptProof(uint256 orderId) external onlyOwner {
        Order storage order = orders[orderId];
        if (order.status != Status.FUNDED) revert InvalidStatus();
        if (!projectTgeActivated[order.projectId]) revert TGENotActivated();
        if (bytes(settlementProof[orderId]).length == 0) revert InvalidStatus(); // no proof submitted

        // Enforce acceptance occurs AFTER the settlement deadline
        if (block.timestamp <= projectSettlementDeadline[order.projectId]) revert InvalidStatus();

        proofAccepted[orderId] = true;
        proofAcceptedAt[orderId] = uint64(block.timestamp);
        
        // Clear rejected flag if it was set
        proofRejected[orderId] = false;

        emit ProofAccepted(orderId, msg.sender);
    }

    /// @notice Buyer accepts the seller's proof (can accept anytime if convinced)
    /// @param orderId The order ID
    /// @dev Buyer can accept proof immediately if they've verified receipt of tokens
    /// @dev Once accepted by buyer, anyone can settle the order
    function acceptProofAsBuyer(uint256 orderId) external {
        Order storage order = orders[orderId];
        if (order.status != Status.FUNDED) revert InvalidStatus();
        if (!projectTgeActivated[order.projectId]) revert TGENotActivated();
        if (bytes(settlementProof[orderId]).length == 0) revert InvalidStatus(); // no proof submitted
        if (msg.sender != order.buyer) revert NotAuthorized(); // Only buyer can call this

        proofAccepted[orderId] = true;
        proofAcceptedAt[orderId] = uint64(block.timestamp);
        
        // Clear rejected flag if it was set
        proofRejected[orderId] = false;

        emit ProofAccepted(orderId, msg.sender);
    }

    /// @notice Owner accepts multiple proofs in a single transaction (batch operation)
    /// @param orderIds Array of order IDs to accept
    /// @dev After acceptance, anyone can permissionlessly settle each order via settleOrderManual()
    /// @dev Acceptance must occur AFTER the settlement deadline (users have exactly 4 hours to submit)
    function acceptProofBatch(uint256[] calldata orderIds) external onlyOwner {
        uint256 length = orderIds.length;
        if (length == 0) revert InvalidAmount();
        
        for (uint256 i = 0; i < length; i++) {
            uint256 orderId = orderIds[i];
            Order storage order = orders[orderId];
            
            // Skip invalid orders instead of reverting (allows partial batch success)
            if (order.status != Status.FUNDED) continue;
            if (!projectTgeActivated[order.projectId]) continue;
            if (bytes(settlementProof[orderId]).length == 0) continue;
            
            // Enforce acceptance occurs AFTER the settlement deadline
            if (block.timestamp <= projectSettlementDeadline[order.projectId]) continue;
            
            proofAccepted[orderId] = true;
            proofAcceptedAt[orderId] = uint64(block.timestamp);
            
            // Clear rejected flag if it was set
            proofRejected[orderId] = false;
            
            emit ProofAccepted(orderId, msg.sender);
        }
    }

    /// @notice Owner rejects the seller's proof (optionally provide reason)
    /// @param orderId The order ID
    /// @param reason Rejection reason (for transparency)
    /// @dev Rejection enables default handling - buyer can call handleDefault() after deadline
    /// @dev Rejection must occur AFTER the settlement deadline (sellers have exactly 4 hours to submit)
    function rejectProof(uint256 orderId, string calldata reason) external onlyOwner {
        Order storage order = orders[orderId];
        if (order.status != Status.FUNDED) revert InvalidStatus();
        if (!projectTgeActivated[order.projectId]) revert TGENotActivated();
        if (bytes(settlementProof[orderId]).length == 0) revert InvalidStatus(); // no proof submitted

        // Enforce rejection occurs AFTER the settlement deadline
        if (block.timestamp <= projectSettlementDeadline[order.projectId]) revert InvalidStatus();

        // Mark proof as rejected (enables default handling)
        proofRejected[orderId] = true;
        
        // Reset proof acceptance if it was previously accepted
        proofAccepted[orderId] = false;

        emit ProofRejected(orderId, msg.sender, reason);
    }

    /// @notice Permissionlessly settles Points project order after admin accepts proof
    /// @param orderId The order to settle
    /// @dev Can be called by ANYONE once proof is accepted (fully trustless after admin approval)
    /// For Points projects, the conversion ratio is informational only (off-chain transfer)
    /// @dev Can only be called after settlement deadline (enforces 4-hour settlement window)
    function settleOrderManual(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        if (order.status != Status.FUNDED) revert InvalidStatus();
        if (!projectTgeActivated[order.projectId]) revert TGENotActivated();
        if (bytes(settlementProof[orderId]).length == 0) revert InvalidStatus();
        
        // Require explicit owner acceptance of proof (prevents unauthorized settlement)
        if (!proofAccepted[orderId]) revert NotAuthorized();
        
        // Permissionless: Anyone can trigger settlement once proof is accepted
        // Must wait for settlement deadline to pass (enforces protocol timing guarantees)
        if (block.timestamp <= projectSettlementDeadline[order.projectId]) {
            revert InvalidStatus(); // Too early, wait for deadline
        }
        
        // This function is for Points projects ONLY (token projects use settleOrder with on-chain delivery)
        address tokenAddress = projectTokenAddress[order.projectId];
        if (tokenAddress != POINTS_SENTINEL) revert InvalidStatus();
        
        // Note: For Points projects, conversion ratio is already applied off-chain
        // Seller should have transferred: (order.amount * projectConversionRatio[projectId]) / 1e18 tokens
        // Admin verifies this before calling acceptProof, then anyone can settle permissionlessly
        
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
        
        // Clean up proof state (tidiness + gas refund)
        delete proofAccepted[orderId];
        delete proofAcceptedAt[orderId];
        delete settlementProof[orderId];
        delete proofRejected[orderId];
        
        // INTERACTIONS: External calls
        // Distribute collateral minus fee
        address(stable).safeTransfer(seller, netToSeller);
        
        // Collect fee
        if (fee > 0) {
            address(stable).safeTransfer(feeCollector, fee);
            emit FeeCollected(projectId, address(stable), fee);
        }
        
        emit OrderSettled(orderId, buyer, seller, fee, 0);
    }

    /// @notice Handle defaulted order (only if proof was rejected or no proof submitted)
    /// @param orderId The order that defaulted
    /// @dev Default can only happen if:
    ///   1. Deadline has passed AND
    ///   2. Either no proof was submitted OR proof was rejected by admin
    /// @dev If proof was submitted but not yet reviewed, buyer must wait for admin decision
    function handleDefault(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        if (order.status != Status.FUNDED) revert InvalidStatus();
        if (!projectTgeActivated[order.projectId]) revert TGENotActivated();
        
        // Must be after deadline
        if (block.timestamp <= projectSettlementDeadline[order.projectId]) revert InvalidStatus();
        
        // Check if proof was submitted
        bool hasProof = bytes(settlementProof[orderId]).length > 0;
        
        // If proof was submitted, it must be rejected to allow default
        // If no proof was submitted, default is allowed
        if (hasProof && !proofRejected[orderId]) {
            // Proof was submitted but not rejected - admin may still accept it
            revert InvalidStatus();
        }
        
        // Calculate compensation and cache values
        uint256 compensation = order.buyerFunds + order.sellerCollateral;
        address buyer = order.buyer;
        
        // EFFECTS: Update state before interactions
        order.status = Status.DEFAULTED;
        
        // Clean up proof state if it exists
        if (hasProof) {
            delete proofRejected[orderId];
            delete settlementProof[orderId];
            delete proofSubmittedAt[orderId];
        }
        
        // INTERACTIONS: External call
        // Refund buyer (seller defaulted)
        address(stable).safeTransfer(buyer, compensation);
        
        emit OrderDefaulted(orderId, buyer, compensation);
    }
}

