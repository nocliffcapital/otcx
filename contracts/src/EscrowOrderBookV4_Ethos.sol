// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {Ownable} from "solady/auth/Ownable.sol";
import {ReentrancyGuard} from "solady/utils/ReentrancyGuard.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";
import {SignatureCheckerLib} from "solady/utils/SignatureCheckerLib.sol";
import {EIP712} from "solady/utils/EIP712.sol";

/**
 * @notice Minimal interface for ProjectRegistryV2
 */
interface IProjectRegistry {
    function isActive(bytes32 projectId) external view returns (bool);
    function getTokenAddress(bytes32 projectId) external view returns (address);
    function isPointsProject(bytes32 projectId) external view returns (bool);
}

/**
 * @notice Extended ERC20 interface with decimals
 */
interface IERC20Metadata {
    function decimals() external view returns (uint8);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/**
 * @title EscrowOrderBookV4_Ethos (EXPERIMENTAL)
 * @author otcX
 * @notice Pre-TGE OTC trading with Ethos-based partial collateral
 * @dev EXPERIMENTAL FEATURES:
 *   - Ethos reputation-based collateral discounts (40%-100%)
 *   - EIP-712 signature verification for score proofs
 *   - Per-wallet nonce tracking to prevent replay
 *   - Configurable tier system (score → minCollateralBps)
 *   - Optional per-project Ethos enablement
 *   - Hard floor (never below 40%) and cap (never above 100%)
 *   - Circuit breaker for emergency disable
 * 
 * @dev Security Guardrails:
 *   - Signature freshness (expiry check)
 *   - Chain ID binding (prevent cross-chain replay)
 *   - Nonce tracking (prevent same-chain replay)
 *   - Opt-out mechanism (seller can choose 100% collateral)
 *   - Default penalties (full collateral to buyer on default)
 */
contract EscrowOrderBookV4_Ethos is Ownable, ReentrancyGuard, EIP712 {
    using SafeTransferLib for address;
    using SignatureCheckerLib for address;
    
    // ========== TYPES ==========
    
    enum Status { 
        OPEN,           // Order created, awaiting counterparty
        FUNDED,         // Both parties locked collateral
        SETTLED,        // Complete - tokens delivered
        DEFAULTED,      // One party defaulted
        CANCELED        // Order canceled
    }
    
    struct Order {
        address seller;
        address buyer;
        bytes32 projectId;
        uint256 amount;         // Token/points amount (18 decimals)
        uint256 unitPrice;      // Price per token in stable (6 decimals stable → 18 decimals)
        uint256 sellerStable;   // Seller collateral (stable)
        uint256 buyerStable;    // Buyer payment (stable)
        Status status;
        uint64 createdAt;
        address allowedTaker;   // address(0) = public, else private
        bool isSell;            // true = sell order, false = buy order
        uint16 collateralBps;   // NEW: Actual collateral percentage used (in basis points)
    }

    /**
     * @notice Ethos score proof for partial collateral
     * @param score Ethos reputation score (0-2800+ scale, aligned with Ethos tiers)
     * @param issuedAt Unix timestamp when proof was issued
     * @param expiry Unix timestamp when proof expires
     * @param nonce Unique nonce per wallet to prevent replay
     * @param signature ECDSA signature from Ethos signer
     */
    struct ScoreProof {
        uint256 score;
        uint64 issuedAt;
        uint64 expiry;
        bytes32 nonce;
        bytes signature;
    }

    struct TGEStatus {
        bool isActive;          // TGE activated
        uint64 activatedAt;     // Timestamp of TGE activation
    }
    
    // ========== STATE ==========
    
    // Core
    address public immutable STABLE;
    uint8 public immutable stableDecimals;
    IProjectRegistry public immutable registry;
    uint256 public nextId;
    mapping(uint256 => Order) public orders;
    
    // Order value limits
    uint256 public maxOrderValue; // In stable decimals
    uint256 public minOrderValue; // In stable decimals (prevents zero-fee orders)
    
    // TGE tracking (per project)
    mapping(bytes32 => TGEStatus) public projectTGE;
    mapping(bytes32 => uint256) public projectConversionRatio; // For Points: ratio (e.g., 1.2e18). For Tokens: 1e18
    mapping(bytes32 => uint64) public projectSettlementDeadline; // Per-project settlement deadline
    mapping(bytes32 => uint64) public projectOriginalDeadline; // Track original for extension cap
    mapping(bytes32 => uint64) public projectSettlementWindow; // Per-project custom window
    
    // Proof tracking (Points only)
    mapping(uint256 => bool) public proofAccepted;
    mapping(uint256 => uint64) public proofAcceptedAt;
    mapping(uint256 => string) public proofURIs;
    
    // Fee system
    address public feeCollector;
    uint16 public settlementFeeBps = 50;    // 0.5% default
    uint16 public cancellationFeeBps = 10;  // 0.1% default
    bool public paused;
    
    // Grace period & settlement
    uint256 public constant GRACE_PERIOD = 1 hours;
    uint256 public constant DEFAULT_SETTLEMENT_WINDOW = 4 hours;
    uint256 public constant MAX_CONVERSION_RATIO = 1000 * 1e18; // 1000:1 max
    uint256 public constant MAX_TOTAL_EXTENSION = 7 days; // Max deadline extension from original
    uint8 public constant REQUIRED_TOKEN_DECIMALS = 18; // Enforce 18-decimal tokens
    
    // ========== ETHOS INTEGRATION ==========
    
    // Ethos signer (EOA or smart wallet that signs score proofs)
    address public ethosSigner;
    
    // Hard floor: minimum collateral percentage (in basis points, e.g., 5000 = 50%)
    uint16 public ethosFloorBps = 5000; // 50% minimum
    
    // Tier mapping: score cutoff → collateral bps
    // Example: score >= 800 → 60%, >= 700 → 80%, >= 600 → 95%, else 100%
    mapping(uint256 => uint16) public tierBps;
    uint256[] public tierCutoffs; // Sorted array for easy iteration
    
    // Nonce tracking to prevent replay attacks
    mapping(address => mapping(bytes32 => bool)) public usedNonces;
    
    // Per-project Ethos enablement (optional circuit breaker)
    mapping(bytes32 => bool) public projectEthosEnabled;
    
    // Global Ethos circuit breaker
    bool public ethosGloballyEnabled = true;
    
    // Ethos proof staleness protection
    uint256 public constant MAX_PROOF_AGE = 7 days; // Proofs older than this are rejected
    
    // EIP-712 typehash for score proof
    bytes32 private constant SCORE_TYPEHASH = keccak256(
        "EthosScore(address wallet,uint256 score,uint64 issuedAt,uint64 expiry,bytes32 nonce,uint256 chainId)"
    );
    
    // ========== EVENTS ==========
    
    // Core events
    event OrderCreated(uint256 indexed id, address indexed creator, bytes32 indexed projectId, bool isSell, uint256 amount, uint256 unitPrice, uint16 collateralBps);
    event OrderFunded(uint256 indexed id, address indexed taker);
    event OrderSettled(uint256 indexed id, uint256 tokenAmount, uint256 stableAmount);
    event OrderCanceled(uint256 indexed id, address indexed canceler);
    event OrderDefaulted(uint256 indexed id, address indexed defaulter);
    
    // TGE events
    event TGEActivated(bytes32 indexed projectId, uint256 conversionRatio, uint64 activatedAt);
    event ConversionRatioUpdated(bytes32 indexed projectId, uint256 oldRatio, uint256 newRatio);
    
    // Proof events (Points)
    event ProofSubmitted(uint256 indexed orderId, string proofURI);
    event ProofAccepted(uint256 indexed orderId, uint64 acceptedAt);
    event ProofRejected(uint256 indexed orderId);
    
    // Admin events
    event FeeCollectorUpdated(address oldCollector, address newCollector);
    event SettlementFeeUpdated(uint16 oldFeeBps, uint16 newFeeBps);
    event CancellationFeeUpdated(uint16 oldFeeBps, uint16 newFeeBps);
    event Paused();
    event Unpaused();
    event MaxOrderValueUpdated(uint256 oldValue, uint256 newValue);
    event MinOrderValueUpdated(uint256 oldValue, uint256 newValue);
    event SettlementDeadlineExtended(bytes32 indexed projectId, uint64 oldDeadline, uint64 newDeadline);
    event SettlementWindowUpdated(bytes32 indexed projectId, uint64 windowSeconds);
    
    // Ethos events
    event EthosSignerUpdated(address indexed oldSigner, address indexed newSigner);
    event EthosFloorUpdated(uint16 oldBps, uint16 newBps);
    event EthosTiersUpdated(uint256[] cutoffs, uint16[] bps);
    event EthosProjectToggled(bytes32 indexed projectId, bool enabled);
    event EthosGlobalToggled(bool enabled);
    event ScoreProofUsed(address indexed wallet, uint256 score, uint16 collateralBps, bytes32 nonce);
    
    // ========== ERRORS ==========
    
    error InvalidProject();
    error InvalidAmount();
    error InvalidPrice();
    error InvalidStatus();
    error PrivateOrder();
    error TGENotActive();
    error TGEAlreadyActive();
    error InvalidConversionRatio();
    error GracePeriodExpired();
    error GracePeriodNotExpired();
    error ProofNotAccepted();
    error ProofAlreadyProcessed();
    error InvalidFee();
    error ContractPaused();
    error CannotCancelAfterProofAccepted();
    error CannotCancelAfterProofSubmitted();
    error SettlementDeadlinePassed();
    error SettlementDeadlineNotPassed();
    error CannotExtendAfterDeadline();
    error OrderValueTooLow();
    error OrderValueTooHigh();
    error TransferAmountMismatch();
    error MakerCannotTakeOwnOrder();
    error InvalidTokenAddress();
    error InsufficientBalance();
    
    // Ethos errors
    error EthosDisabled();
    error EthosProjectDisabled();
    error ScoreExpired();
    error StaleProof();
    error InvalidScoreSignature();
    error ScoreReplay();
    error InvalidCollateralBps();
    error InvalidTierConfiguration();
    
    // ========== MODIFIERS ==========
    
    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }
    
    // ========== CONSTRUCTOR ==========
    
    constructor(
        address _stable,
        address _feeCollector,
        address _registry
    ) {
        _initializeOwner(msg.sender);
        STABLE = _stable;
        stableDecimals = IERC20Metadata(_stable).decimals();
        require(stableDecimals == 6 || stableDecimals == 18, "UNSUPPORTED_DECIMALS");
        
        feeCollector = _feeCollector;
        registry = IProjectRegistry(_registry);
        nextId = 1;
        
        // Set reasonable defaults
        maxOrderValue = 1_000_000 * (10 ** stableDecimals); // $1M
        minOrderValue = 100 * (10 ** stableDecimals);       // $100 (prevents zero-fee orders)
        
        // Initialize default tiers (aligned with Ethos reputation levels)
        // Clean 10% increments for savings (50%, 40%, 30%, 20%, 10%)
        // Ethos Tiers:
        // 0-799: Untrusted → 100%
        // 800-1199: Questionable → 100%
        // 1200-1399: Neutral → 100%
        // 1400-1599: Known → 100%
        // 1600-1799: Established → 100%
        // 1800-1999: Reputable → 90% (10% saving)
        // 2000-2199: Exemplary → 80% (20% saving)
        // 2200-2399: Distinguished → 70% (30% saving)
        // 2400-2599: Revered → 60% (40% saving)
        // 2600+: Renowned → 50% (50% saving)
        tierCutoffs.push(1800); // Reputable
        tierCutoffs.push(2000); // Exemplary
        tierCutoffs.push(2200); // Distinguished
        tierCutoffs.push(2400); // Revered
        tierCutoffs.push(2600); // Renowned
        tierBps[1800] = 9000; // 90%
        tierBps[2000] = 8000; // 80%
        tierBps[2200] = 7000; // 70%
        tierBps[2400] = 6000; // 60%
        tierBps[2600] = 5000; // 50%
    }
    
    // ========== HELPERS ==========
    
    /**
     * @notice Calculate total value in stable decimals from amount and unitPrice
     * @param amount Token amount (18 decimals)
     * @param unitPrice Price per token (18 decimals, represents stable/token)
     * @return Total value in stable decimals
     * @dev Handles conversion from 18-decimal amounts to stableDecimals (typically 6 for USDC)
     */
    function _quoteTotalValue(uint256 amount, uint256 unitPrice) internal view returns (uint256) {
        // amount (18 decimals) * unitPrice (18 decimals) / 1e18 = 18 decimals
        uint256 value18 = (amount * unitPrice) / 1e18;
        
        // Scale to stableDecimals
        if (stableDecimals < 18) {
            return value18 / (10 ** (18 - stableDecimals));
        } else if (stableDecimals > 18) {
            return value18 * (10 ** (stableDecimals - 18));
        } else {
            return value18;
        }
    }
    
    // ========== ETHOS: COLLATERAL CALCULATION ==========
    
    /**
     * @notice Calculate collateral basis points for a given Ethos score
     * @param score Ethos reputation score (0-2800+ scale)
     * @return Collateral requirement in basis points (5000-10000 = 50%-100%)
     */
    function _collateralBpsForScore(uint256 score) internal view returns (uint16) {
        // Iterate through tiers from highest to lowest
        for (uint256 i = tierCutoffs.length; i > 0; i--) {
            uint256 cutoff = tierCutoffs[i - 1];
            if (score >= cutoff) {
                uint16 bps = tierBps[cutoff];
                // Apply floor
                return bps < ethosFloorBps ? ethosFloorBps : bps;
            }
        }
        // Below all tiers → 100% collateral
        return 10000;
    }
    
    /**
     * @notice Verify Ethos score proof using EIP-712 signature
     * @param wallet Address whose score is being verified
     * @param proof Score proof with signature
     */
    function _verifyScoreProof(address wallet, ScoreProof calldata proof) internal {
        // Check global and signer state
        if (ethosSigner == address(0)) revert EthosDisabled();
        if (!ethosGloballyEnabled) revert EthosDisabled();
        
        // Check expiry
        if (block.timestamp > proof.expiry) revert ScoreExpired();
        
        // Check staleness - proof must be recent
        if (block.timestamp > proof.issuedAt + MAX_PROOF_AGE) revert StaleProof();
        
        // Check replay
        if (usedNonces[wallet][proof.nonce]) revert ScoreReplay();
        
        // Construct EIP-712 digest
        bytes32 structHash = keccak256(abi.encode(
            SCORE_TYPEHASH,
            wallet,
            proof.score,
            proof.issuedAt,
            proof.expiry,
            proof.nonce,
            block.chainid
        ));
        
        bytes32 digest = _hashTypedData(structHash);
        
        // Verify signature
        if (!ethosSigner.isValidSignatureNow(digest, proof.signature)) {
            revert InvalidScoreSignature();
        }
    }
    
    // ========== ETHOS: ADMIN FUNCTIONS ==========
    
    /**
     * @notice Set the Ethos signer address
     * @param signer Address that signs score proofs (EOA or smart wallet)
     */
    function setEthosSigner(address signer) external onlyOwner {
        emit EthosSignerUpdated(ethosSigner, signer);
        ethosSigner = signer;
    }
    
    /**
     * @notice Set the hard floor for collateral (minimum percentage)
     * @param bps Basis points (4000-10000 = 40%-100%)
     */
    function setEthosFloorBps(uint16 bps) external onlyOwner {
        if (bps < 4000 || bps > 10000) revert InvalidCollateralBps();
        emit EthosFloorUpdated(ethosFloorBps, bps);
        ethosFloorBps = bps;
    }
    
    /**
     * @notice Update tier configuration
     * @param cutoffs Sorted array of score cutoffs (ascending)
     * @param bps Corresponding collateral requirements in basis points
     * @dev Example: cutoffs=[600,700,800], bps=[9500,8000,6000]
     */
    function setEthosTiers(uint256[] calldata cutoffs, uint16[] calldata bps) external onlyOwner {
        if (cutoffs.length != bps.length) revert InvalidTierConfiguration();
        if (cutoffs.length == 0) revert InvalidTierConfiguration();
        
        // Validate cutoffs are sorted ascending
        for (uint256 i = 1; i < cutoffs.length; i++) {
            if (cutoffs[i] <= cutoffs[i-1]) revert InvalidTierConfiguration();
        }
        
        // Validate bps are within range
        for (uint256 i = 0; i < bps.length; i++) {
            if (bps[i] < 4000 || bps[i] > 10000) revert InvalidCollateralBps();
        }
        
        // Clear old tiers
        for (uint256 i = 0; i < tierCutoffs.length; i++) {
            delete tierBps[tierCutoffs[i]];
        }
        delete tierCutoffs;
        
        // Set new tiers
        for (uint256 i = 0; i < cutoffs.length; i++) {
            tierCutoffs.push(cutoffs[i]);
            tierBps[cutoffs[i]] = bps[i];
        }
        
        emit EthosTiersUpdated(cutoffs, bps);
    }
    
    /**
     * @notice Enable/disable Ethos for a specific project
     * @param projectId Project identifier
     * @param enabled Whether Ethos discounts are allowed
     */
    function setProjectEthosEnabled(bytes32 projectId, bool enabled) external onlyOwner {
        projectEthosEnabled[projectId] = enabled;
        emit EthosProjectToggled(projectId, enabled);
    }
    
    /**
     * @notice Global Ethos circuit breaker
     * @param enabled Whether Ethos is globally enabled
     */
    function setEthosGloballyEnabled(bool enabled) external onlyOwner {
        ethosGloballyEnabled = enabled;
        emit EthosGlobalToggled(enabled);
    }
    
    // ========== CORE: ORDER CREATION ==========
    
    /**
     * @notice Create a new order with optional Ethos discount
     * @param projectId Project identifier (keccak256(abi.encodePacked(slug)))
     * @param amount Token/points amount (18 decimals)
     * @param unitPrice Price per token in stable (6 decimals stable → 18 decimals)
     * @param isSell True for sell order, false for buy order
     * @param allowedTaker Specific taker address (address(0) = public order)
     * @param useEthos Whether to apply Ethos discount (seller only)
     * @param proof Score proof (ignored if useEthos=false)
     * @return orderId Created order ID
     */
    function createOrder(
        bytes32 projectId,
        uint256 amount,
        uint256 unitPrice,
        bool isSell,
        address allowedTaker,
        bool useEthos,
        ScoreProof calldata proof
    ) external nonReentrant whenNotPaused returns (uint256) {
        // Validate project
        if (!registry.isActive(projectId)) revert InvalidProject();
        
        // Validate amounts
        if (amount == 0) revert InvalidAmount();
        if (unitPrice == 0) revert InvalidPrice();
        
        // Calculate total value (in stable decimals)
        uint256 totalValue = _quoteTotalValue(amount, unitPrice);
        
        // Enforce order value limits
        if (totalValue > maxOrderValue) revert OrderValueTooHigh();
        if (totalValue < minOrderValue) revert OrderValueTooLow();
        
        // Default to 100% collateral
        uint16 collateralBps = 10000;
        
        // Apply Ethos discount if requested and conditions met
        if (isSell && useEthos) {
            // Check if Ethos is enabled globally and for this project
            if (ethosSigner == address(0)) revert EthosDisabled();
            if (!ethosGloballyEnabled) revert EthosDisabled();
            if (!projectEthosEnabled[projectId]) revert EthosProjectDisabled();
            
            // Verify score proof
            _verifyScoreProof(msg.sender, proof);
            
            // Mark nonce as used
            usedNonces[msg.sender][proof.nonce] = true;
            
            // Calculate collateral based on score
            uint16 scoreTierBps = _collateralBpsForScore(proof.score);
            collateralBps = scoreTierBps < ethosFloorBps ? ethosFloorBps : scoreTierBps;
            
            emit ScoreProofUsed(msg.sender, proof.score, collateralBps, proof.nonce);
        }
        
        // Calculate required collateral
        uint256 collateral = (totalValue * collateralBps) / 10000;
        
        // Create order
        uint256 orderId = nextId++;
        
        if (isSell) {
            // Seller posts collateral (partial if Ethos applied) - balance-delta guarded
            uint256 balBefore = IERC20(STABLE).balanceOf(address(this));
            STABLE.safeTransferFrom(msg.sender, address(this), collateral);
            uint256 balAfter = IERC20(STABLE).balanceOf(address(this));
            if (balAfter - balBefore != collateral) revert TransferAmountMismatch();
            
            orders[orderId] = Order({
                seller: msg.sender,
                buyer: address(0),
                projectId: projectId,
                amount: amount,
                unitPrice: unitPrice,
                sellerStable: collateral,
                buyerStable: 0,
                status: Status.OPEN,
                createdAt: uint64(block.timestamp),
                allowedTaker: allowedTaker,
                isSell: true,
                collateralBps: collateralBps
            });
        } else {
            // Buyer posts full payment (always 100%) - balance-delta guarded
            uint256 balBefore = IERC20(STABLE).balanceOf(address(this));
            STABLE.safeTransferFrom(msg.sender, address(this), totalValue);
            uint256 balAfter = IERC20(STABLE).balanceOf(address(this));
            if (balAfter - balBefore != totalValue) revert TransferAmountMismatch();
            
            orders[orderId] = Order({
                seller: address(0),
                buyer: msg.sender,
                projectId: projectId,
                amount: amount,
                unitPrice: unitPrice,
                sellerStable: 0,
                buyerStable: totalValue,
                status: Status.OPEN,
                createdAt: uint64(block.timestamp),
                allowedTaker: allowedTaker,
                isSell: false,
                collateralBps: 10000 // Buyer always posts 100%
            });
        }
        
        emit OrderCreated(orderId, msg.sender, projectId, isSell, amount, unitPrice, collateralBps);
        return orderId;
    }
    
    /**
     * @notice Take an existing order (fund the counterparty side)
     * @param orderId Order ID to take
     */
    function takeOrder(uint256 orderId) external nonReentrant whenNotPaused {
        Order storage order = orders[orderId];
        
        // Validate
        if (order.status != Status.OPEN) revert InvalidStatus();
        if (order.allowedTaker != address(0) && order.allowedTaker != msg.sender) revert PrivateOrder();
        
        // Prevent maker from taking own order
        if (order.isSell && msg.sender == order.seller) revert MakerCannotTakeOwnOrder();
        if (!order.isSell && msg.sender == order.buyer) revert MakerCannotTakeOwnOrder();
        
        // Calculate total value (in stable decimals)
        uint256 totalValue = _quoteTotalValue(order.amount, order.unitPrice);
        
        if (order.isSell) {
            // Taking a sell order → become the buyer (post full payment) - balance-delta guarded
            order.buyer = msg.sender;
            order.buyerStable = totalValue;
            
            uint256 balBefore = IERC20Metadata(STABLE).balanceOf(address(this));
            STABLE.safeTransferFrom(msg.sender, address(this), totalValue);
            uint256 balAfter = IERC20Metadata(STABLE).balanceOf(address(this));
            if (balAfter - balBefore != totalValue) revert TransferAmountMismatch();
        } else {
            // Taking a buy order → become the seller (post collateral based on order's collateralBps) - balance-delta guarded
            order.seller = msg.sender;
            uint256 collateral = (totalValue * order.collateralBps) / 10000;
            order.sellerStable = collateral;
            
            uint256 balBefore = IERC20Metadata(STABLE).balanceOf(address(this));
            STABLE.safeTransferFrom(msg.sender, address(this), collateral);
            uint256 balAfter = IERC20Metadata(STABLE).balanceOf(address(this));
            if (balAfter - balBefore != collateral) revert TransferAmountMismatch();
        }
        
        order.status = Status.FUNDED;
        emit OrderFunded(orderId, msg.sender);
    }
    
    // ========== TGE & SETTLEMENT ==========
    
    /**
     * @notice Activate TGE for a project
     * @param projectId Project identifier
     * @param conversionRatio Conversion ratio (18 decimals, 1e18 = 1:1)
     */
    function activateTGE(bytes32 projectId, uint256 conversionRatio) external onlyOwner {
        if (projectTGE[projectId].isActive) revert TGEAlreadyActive();
        if (conversionRatio == 0 || conversionRatio > MAX_CONVERSION_RATIO) revert InvalidConversionRatio();
        
        uint64 activatedAt = uint64(block.timestamp);
        projectTGE[projectId] = TGEStatus({
            isActive: true,
            activatedAt: activatedAt
        });
        projectConversionRatio[projectId] = conversionRatio;
        
        // Set settlement deadline (use custom window or default 4 hours after grace period)
        uint64 window = projectSettlementWindow[projectId];
        if (window == 0) window = uint64(DEFAULT_SETTLEMENT_WINDOW);
        
        uint64 deadline = activatedAt + uint64(GRACE_PERIOD) + window;
        projectSettlementDeadline[projectId] = deadline;
        projectOriginalDeadline[projectId] = deadline; // Track for extension cap
        
        emit TGEActivated(projectId, conversionRatio, activatedAt);
    }
    
    /**
     * @notice Update conversion ratio (within grace period only)
     * @param projectId Project identifier
     * @param newRatio New conversion ratio
     */
    function updateConversionRatio(bytes32 projectId, uint256 newRatio) external onlyOwner {
        TGEStatus memory tge = projectTGE[projectId];
        if (!tge.isActive) revert TGENotActive();
        if (block.timestamp > tge.activatedAt + GRACE_PERIOD) revert GracePeriodExpired();
        if (newRatio == 0 || newRatio > MAX_CONVERSION_RATIO) revert InvalidConversionRatio();
        
        uint256 oldRatio = projectConversionRatio[projectId];
        projectConversionRatio[projectId] = newRatio;
        
        emit ConversionRatioUpdated(projectId, oldRatio, newRatio);
    }
    
    /**
     * @notice Settle a Token project order (automatic, permissionless)
     * @param orderId Order ID to settle
     * @dev Only for Token projects (not Points). Enforces 18-decimal tokens.
     */
    function settleOrder(uint256 orderId) external nonReentrant whenNotPaused {
        Order storage order = orders[orderId];
        
        // Validate
        if (order.status != Status.FUNDED) revert InvalidStatus();
        
        // Explicit check: cannot settle Points projects (use proof flow instead)
        if (registry.isPointsProject(order.projectId)) revert InvalidStatus();
        
        TGEStatus memory tge = projectTGE[order.projectId];
        if (!tge.isActive) revert TGENotActive();
        if (block.timestamp <= tge.activatedAt + GRACE_PERIOD) revert GracePeriodNotExpired();
        
        // Enforce settlement deadline (only for Token projects)
        if (block.timestamp > projectSettlementDeadline[order.projectId]) {
            revert SettlementDeadlinePassed();
        }
        
        // Get token address and validate decimals
        address token = registry.getTokenAddress(order.projectId);
        if (token == address(0)) revert InvalidTokenAddress();
        
        // Enforce 18-decimal tokens for consistent math
        uint8 tokenDecimals = IERC20Metadata(token).decimals();
        if (tokenDecimals != REQUIRED_TOKEN_DECIMALS) revert InvalidTokenAddress();
        
        // Get conversion ratio
        uint256 ratio = projectConversionRatio[order.projectId];
        uint256 tokenAmount = (order.amount * ratio) / 1e18;
        
        // Pull tokens from seller (balance-delta guarded)
        uint256 tokenBalBefore = IERC20Metadata(token).balanceOf(address(this));
        SafeTransferLib.safeTransferFrom(token, order.seller, address(this), tokenAmount);
        uint256 tokenBalAfter = IERC20Metadata(token).balanceOf(address(this));
        if (tokenBalAfter - tokenBalBefore != tokenAmount) revert TransferAmountMismatch();
        
        // Calculate settlement fee (0.5% of stable amount)
        uint256 stableFee = (order.buyerStable * settlementFeeBps) / 10000;
        uint256 stableToSeller = order.buyerStable - stableFee;
        
        // Optionally split token fee (0.5% of tokens)
        uint256 tokenFee = (tokenAmount * settlementFeeBps) / 10000;
        uint256 tokenToBuyer = tokenAmount - tokenFee;
        
        // Distribute stable
        STABLE.safeTransfer(order.seller, stableToSeller + order.sellerStable);
        STABLE.safeTransfer(feeCollector, stableFee);
        
        // Distribute tokens
        SafeTransferLib.safeTransfer(token, order.buyer, tokenToBuyer);
        if (tokenFee > 0) {
            SafeTransferLib.safeTransfer(token, feeCollector, tokenFee);
        }
        
        // Mark settled
        order.status = Status.SETTLED;
        emit OrderSettled(orderId, tokenAmount, order.buyerStable);
    }
    
    /**
     * @notice Submit proof of token transfer (Points projects only)
     * @param orderId Order ID
     * @param proofURI IPFS URI of the proof
     */
    function submitProof(uint256 orderId, string calldata proofURI) external nonReentrant {
        Order storage order = orders[orderId];
        
        // Validate
        if (order.status != Status.FUNDED) revert InvalidStatus();
        if (msg.sender != order.seller) revert Unauthorized();
        
        TGEStatus memory tge = projectTGE[order.projectId];
        if (!tge.isActive) revert TGENotActive();
        if (block.timestamp <= tge.activatedAt + GRACE_PERIOD) revert GracePeriodNotExpired();
        
        // Check if proof already processed
        if (proofAccepted[orderId] || bytes(proofURIs[orderId]).length > 0) {
            revert ProofAlreadyProcessed();
        }
        
        proofURIs[orderId] = proofURI;
        emit ProofSubmitted(orderId, proofURI);
    }
    
    /**
     * @notice Accept a submitted proof (owner only)
     * @param orderId Order ID
     */
    function acceptProof(uint256 orderId) external onlyOwner {
        Order storage order = orders[orderId];
        
        if (order.status != Status.FUNDED) revert InvalidStatus();
        if (bytes(proofURIs[orderId]).length == 0) revert InvalidStatus();
        if (proofAccepted[orderId]) revert ProofAlreadyProcessed();
        
        proofAccepted[orderId] = true;
        proofAcceptedAt[orderId] = uint64(block.timestamp);
        
        emit ProofAccepted(orderId, uint64(block.timestamp));
    }
    
    /**
     * @notice Reject a submitted proof (owner only)
     * @param orderId Order ID
     */
    function rejectProof(uint256 orderId) external onlyOwner {
        Order storage order = orders[orderId];
        
        if (order.status != Status.FUNDED) revert InvalidStatus();
        if (bytes(proofURIs[orderId]).length == 0) revert InvalidStatus();
        if (proofAccepted[orderId]) revert ProofAlreadyProcessed();
        
        // Clear proof
        delete proofURIs[orderId];
        
        emit ProofRejected(orderId);
    }
    
    /**
     * @notice Settle a Points project order manually (permissionless after proof accepted)
     * @param orderId Order ID to settle
     */
    function settleOrderManual(uint256 orderId) external nonReentrant whenNotPaused {
        Order storage order = orders[orderId];
        
        // Validate
        if (order.status != Status.FUNDED) revert InvalidStatus();
        if (!proofAccepted[orderId]) revert ProofNotAccepted();
        
        TGEStatus memory tge = projectTGE[order.projectId];
        if (!tge.isActive) revert TGENotActive();
        
        // Calculate settlement fee (0.5% of stable amount)
        uint256 stableFee = (order.buyerStable * settlementFeeBps) / 10000;
        uint256 stableToSeller = order.buyerStable - stableFee;
        
        // Distribute stable
        STABLE.safeTransfer(order.seller, stableToSeller + order.sellerStable);
        STABLE.safeTransfer(feeCollector, stableFee);
        
        // Clean up proof state
        delete proofAccepted[orderId];
        delete proofAcceptedAt[orderId];
        delete proofURIs[orderId];
        
        // Mark settled
        order.status = Status.SETTLED;
        emit OrderSettled(orderId, order.amount, order.buyerStable);
    }
    
    /**
     * @notice Cancel an open order
     * @param orderId Order ID to cancel
     */
    function cancelOrder(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        
        // Validate
        if (order.status != Status.OPEN && order.status != Status.FUNDED) revert InvalidStatus();
        
        // Only creator or owner can cancel
        bool isCreator = (order.isSell && msg.sender == order.seller) || 
                         (!order.isSell && msg.sender == order.buyer);
        if (!isCreator && msg.sender != owner()) revert Unauthorized();
        
        // Cannot cancel Points orders once proof is submitted (not just accepted)
        if (order.status == Status.FUNDED && bytes(proofURIs[orderId]).length > 0) {
            revert CannotCancelAfterProofSubmitted();
        }
        
        // Calculate cancellation fee (0.1% of order value)
        uint256 totalValue = _quoteTotalValue(order.amount, order.unitPrice);
        uint256 cancelFee = (totalValue * cancellationFeeBps) / 10000;
        
        // Refund with fee deduction
        if (order.status == Status.OPEN) {
            if (order.isSell) {
                uint256 refund = order.sellerStable > cancelFee ? order.sellerStable - cancelFee : 0;
                if (refund > 0) STABLE.safeTransfer(order.seller, refund);
                if (cancelFee > 0) STABLE.safeTransfer(feeCollector, cancelFee);
            } else {
                uint256 refund = order.buyerStable > cancelFee ? order.buyerStable - cancelFee : 0;
                if (refund > 0) STABLE.safeTransfer(order.buyer, refund);
                if (cancelFee > 0) STABLE.safeTransfer(feeCollector, cancelFee);
            }
        } else {
            // FUNDED - refund both parties with fee split
            uint256 sellerRefund = order.sellerStable > (cancelFee / 2) ? order.sellerStable - (cancelFee / 2) : 0;
            uint256 buyerRefund = order.buyerStable > (cancelFee / 2) ? order.buyerStable - (cancelFee / 2) : 0;
            
            if (sellerRefund > 0) STABLE.safeTransfer(order.seller, sellerRefund);
            if (buyerRefund > 0) STABLE.safeTransfer(order.buyer, buyerRefund);
            if (cancelFee > 0) STABLE.safeTransfer(feeCollector, cancelFee);
        }
        
        order.status = Status.CANCELED;
        emit OrderCanceled(orderId, msg.sender);
    }
    
    /**
     * @notice Handle defaulted order after settlement deadline passes
     * @param orderId Order ID to default
     * @dev Can be called by anyone after deadline. Compensates buyer with seller's collateral.
     */
    function handleDefault(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        
        // Validate
        if (order.status != Status.FUNDED) revert InvalidStatus();
        
        TGEStatus memory tge = projectTGE[order.projectId];
        if (!tge.isActive) revert TGENotActive();
        
        // Only after settlement deadline
        if (block.timestamp <= projectSettlementDeadline[order.projectId]) {
            revert SettlementDeadlineNotPassed();
        }
        
        // Check if this is a Points project with pending proof
        bool isPoints = registry.isPointsProject(order.projectId);
        
        if (isPoints) {
            // Points project - check if proof was submitted but not reviewed
            bool proofSubmitted = bytes(proofURIs[orderId]).length > 0;
            bool proofReviewed = proofAccepted[orderId];
            
            if (proofSubmitted && !proofReviewed) {
                // Proof pending review - admin must review first
                revert ProofNotAccepted();
            }
        }
        
        // Default handling: Buyer gets full refund + seller's collateral
        // Seller loses collateral (penalty for default)
        uint256 totalCompensation = order.buyerStable + order.sellerStable;
        
        STABLE.safeTransfer(order.buyer, totalCompensation);
        
        // Clean up proof state if any
        if (bytes(proofURIs[orderId]).length > 0) {
            delete proofURIs[orderId];
        }
        delete proofAccepted[orderId];
        delete proofAcceptedAt[orderId];
        
        order.status = Status.DEFAULTED;
        emit OrderDefaulted(orderId, order.seller);
    }
    
    // ========== ADMIN ==========
    
    function setFeeCollector(address _feeCollector) external onlyOwner {
        emit FeeCollectorUpdated(feeCollector, _feeCollector);
        feeCollector = _feeCollector;
    }
    
    function setSettlementFee(uint16 feeBps) external onlyOwner {
        if (feeBps > 500) revert InvalidFee(); // Max 5%
        emit SettlementFeeUpdated(settlementFeeBps, feeBps);
        settlementFeeBps = feeBps;
    }
    
    function setCancellationFee(uint16 feeBps) external onlyOwner {
        if (feeBps > 500) revert InvalidFee(); // Max 5%
        emit CancellationFeeUpdated(cancellationFeeBps, feeBps);
        cancellationFeeBps = feeBps;
    }
    
    function pause() external onlyOwner {
        paused = true;
        emit Paused();
    }
    
    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused();
    }
    
    /**
     * @notice Set maximum order value
     * @param value Max order value in stable decimals
     */
    function setMaxOrderValue(uint256 value) external onlyOwner {
        emit MaxOrderValueUpdated(maxOrderValue, value);
        maxOrderValue = value;
    }
    
    /**
     * @notice Set minimum order value
     * @param value Min order value in stable decimals (prevents zero-fee orders)
     */
    function setMinOrderValue(uint256 value) external onlyOwner {
        emit MinOrderValueUpdated(minOrderValue, value);
        minOrderValue = value;
    }
    
    /**
     * @notice Set custom settlement window for a project
     * @param projectId Project identifier
     * @param windowSeconds Custom settlement window in seconds (e.g., 12 hours for busy TGEs)
     */
    function setProjectSettlementWindow(bytes32 projectId, uint64 windowSeconds) external onlyOwner {
        require(windowSeconds >= 1 hours && windowSeconds <= 48 hours, "INVALID_WINDOW");
        projectSettlementWindow[projectId] = windowSeconds;
        emit SettlementWindowUpdated(projectId, windowSeconds);
    }
    
    /**
     * @notice Extend settlement deadline for a project
     * @param projectId Project identifier
     * @param newDeadline New deadline timestamp
     * @dev Cannot extend after current deadline or beyond MAX_TOTAL_EXTENSION from original
     */
    function extendSettlementDeadline(bytes32 projectId, uint64 newDeadline) external onlyOwner {
        TGEStatus memory tge = projectTGE[projectId];
        if (!tge.isActive) revert TGENotActive();
        
        uint64 currentDeadline = projectSettlementDeadline[projectId];
        uint64 originalDeadline = projectOriginalDeadline[projectId];
        
        // Cannot extend after deadline already passed
        if (block.timestamp > currentDeadline) revert CannotExtendAfterDeadline();
        
        // Must be extending forward
        if (newDeadline <= currentDeadline) revert InvalidAmount();
        
        // Cap total extension at MAX_TOTAL_EXTENSION
        if (newDeadline > originalDeadline + uint64(MAX_TOTAL_EXTENSION)) {
            revert InvalidAmount();
        }
        
        emit SettlementDeadlineExtended(projectId, currentDeadline, newDeadline);
        projectSettlementDeadline[projectId] = newDeadline;
    }
    
    /**
     * @notice Admin nudge to unlock proof review (emergency use)
     * @param orderId Order ID with pending proof
     * @param autoExtend If true, extends deadline by 24h; if false, auto-rejects proof
     * @dev Use when proof is pending review and deadline is approaching
     */
    function nudgeProofReview(uint256 orderId, bool autoExtend) external onlyOwner {
        Order storage order = orders[orderId];
        
        // Validate: must be funded with pending proof
        if (order.status != Status.FUNDED) revert InvalidStatus();
        if (bytes(proofURIs[orderId]).length == 0) revert ProofNotAccepted();
        if (proofAccepted[orderId]) revert InvalidStatus(); // Already reviewed
        
        bytes32 projectId = order.projectId;
        uint64 currentDeadline = projectSettlementDeadline[projectId];
        
        if (autoExtend) {
            // Extend project deadline by 24h to allow review
            uint64 newDeadline = currentDeadline + 24 hours;
            uint64 originalDeadline = projectOriginalDeadline[projectId];
            
            // Respect MAX_TOTAL_EXTENSION
            if (newDeadline > originalDeadline + uint64(MAX_TOTAL_EXTENSION)) {
                newDeadline = originalDeadline + uint64(MAX_TOTAL_EXTENSION);
            }
            
            emit SettlementDeadlineExtended(projectId, currentDeadline, newDeadline);
            projectSettlementDeadline[projectId] = newDeadline;
        } else {
            // Auto-reject proof to unlock default handling
            emit ProofRejected(orderId);
            delete proofURIs[orderId];
            delete proofAccepted[orderId];
        }
    }
    
    // ========== VIEW FUNCTIONS ==========
    
    /**
     * @notice Get current tier configuration
     * @return cutoffs Array of score cutoffs
     * @return bps Array of corresponding collateral requirements
     */
    /**
     * @notice Preview settlement amounts for an order
     * @param orderId Order ID to preview
     * @return tokenToBuyer Tokens buyer will receive
     * @return tokenFee Token fee to fee collector
     * @return stableToSeller Stable seller will receive (including collateral return)
     * @return stableFee Stable fee to fee collector
     * @dev Useful for UI and off-chain validation
     */
    function previewSettlementAmounts(uint256 orderId) 
        external 
        view 
        returns (
            uint256 tokenToBuyer,
            uint256 tokenFee,
            uint256 stableToSeller,
            uint256 stableFee
        ) 
    {
        Order storage order = orders[orderId];
        
        // Calculate token amounts
        uint256 ratio = projectConversionRatio[order.projectId];
        uint256 tokenAmount = (order.amount * ratio) / 1e18;
        tokenFee = (tokenAmount * settlementFeeBps) / 10000;
        tokenToBuyer = tokenAmount - tokenFee;
        
        // Calculate stable amounts
        stableFee = (order.buyerStable * settlementFeeBps) / 10000;
        stableToSeller = order.buyerStable - stableFee + order.sellerStable;
    }
    
    function getEthosTiers() external view returns (uint256[] memory cutoffs, uint16[] memory bps) {
        cutoffs = tierCutoffs;
        bps = new uint16[](tierCutoffs.length);
        for (uint256 i = 0; i < tierCutoffs.length; i++) {
            bps[i] = tierBps[tierCutoffs[i]];
        }
    }
    
    /**
     * @notice Preview collateral requirement for a given score
     * @param score Ethos reputation score
     * @return Collateral requirement in basis points
     */
    function previewCollateralBps(uint256 score) external view returns (uint16) {
        return _collateralBpsForScore(score);
    }
    
    /**
     * @notice Check if a nonce has been used
     * @param wallet Wallet address
     * @param nonce Nonce to check
     * @return Whether the nonce has been used
     */
    function isNonceUsed(address wallet, bytes32 nonce) external view returns (bool) {
        return usedNonces[wallet][nonce];
    }
    
    // ========== EIP-712 ==========
    
    function _domainNameAndVersion() internal pure override returns (string memory, string memory) {
        return ("EscrowOrderBookV4_Ethos", "1");
    }
}

