# Critical Fixes for EscrowOrderBookV4_Ethos

**Status:** 🚨 INCOMPLETE - DO NOT DEPLOY

---

## Summary

The current `EscrowOrderBookV4_Ethos.sol` has **critical bugs** that will cause fund loss. This document outlines all required fixes before any testing with real funds.

---

## ✅ Already Fixed

1. ✅ Added `getTokenAddress()` and `isPointsProject()` to IProjectRegistry interface
2. ✅ Added `stableDecimals` immutable
3. ✅ Added `maxOrderValue` state variable
4. ✅ Added `projectSettlementDeadline` mapping
5. ✅ Added `DEFAULT_SETTLEMENT_WINDOW` constant
6. ✅ Added `MAX_PROOF_AGE` constant for staleness check
7. ✅ Added all missing errors: `Unauthorized`, `CannotCancelAfterProofSubmitted`, `MakerCannotTakeOwnOrder`, `OrderValueTooHigh`, `InvalidTokenAddress`, `InsufficientTokenBalance`, `StaleProof`

---

## 🚨 Still TODO (Critical)

### 1. Constructor - Initialize stableDecimals & maxOrderValue

**Current:**
```solidity
constructor(
    address _stable,
    address _feeCollector,
    address _registry
) {
    _initializeOwner(msg.sender);
    STABLE = _stable;
    feeCollector = _feeCollector;
    registry = IProjectRegistry(_registry);
    nextId = 1;
    // ... tier initialization ...
}
```

**Fixed:**
```solidity
constructor(
    address _stable,
    address _feeCollector,
    address _registry
) {
    _initializeOwner(msg.sender);
    STABLE = _stable;
    stableDecimals = IERC20(_stable).decimals(); // READ decimals
    require(stableDecimals == 6 || stableDecimals == 18, "UNSUPPORTED_DECIMALS");
    
    feeCollector = _feeCollector;
    registry = IProjectRegistry(_registry);
    nextId = 1;
    
    // Set reasonable default (e.g., $1M for 6 decimals, 1M * 1e6)
    maxOrderValue = 1_000_000 * (10 ** stableDecimals);
    
    // ... tier initialization ...
}
```

---

### 2. Add Helper Function - `_quoteTotalValue()`

**Add before `_collateralBpsForScore()`:**

```solidity
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
```

---

### 3. Update `_verifyScoreProof()` - Add Staleness Check

**Current:**
```solidity
// Check expiry
if (block.timestamp > proof.expiry) revert ScoreExpired();

// Check replay
if (usedNonces[wallet][proof.nonce]) revert ScoreReplay();
```

**Fixed:**
```solidity
// Check expiry
if (block.timestamp > proof.expiry) revert ScoreExpired();

// Check staleness - proof must be recent
if (block.timestamp > proof.issuedAt + MAX_PROOF_AGE) revert StaleProof();

// Check replay
if (usedNonces[wallet][proof.nonce]) revert ScoreReplay();
```

---

### 4. Update `createOrder()` - Use `_quoteTotalValue()` & Add Max Check

**Current:**
```solidity
// Calculate total value
uint256 totalValue = (amount * unitPrice) / 1e18;
```

**Fixed:**
```solidity
// Calculate total value
uint256 totalValue = _quoteTotalValue(amount, unitPrice);

// Enforce max order value
if (totalValue > maxOrderValue) revert OrderValueTooHigh();
```

**Also in `createOrder()` - Balance-delta check for STABLE pulls:**

Replace:
```solidity
// Seller posts collateral (partial if Ethos applied)
STABLE.safeTransferFrom(msg.sender, address(this), collateral);
```

With:
```solidity
// Seller posts collateral (partial if Ethos applied) - balance-delta guarded
uint256 balBefore = IERC20(STABLE).balanceOf(address(this));
STABLE.safeTransferFrom(msg.sender, address(this), collateral);
uint256 balAfter = IERC20(STABLE).balanceOf(address(this));
if (balAfter - balBefore != collateral) revert InsufficientTokenBalance();
```

Same for buyer side:
```solidity
// Buyer posts full payment (always 100%) - balance-delta guarded
uint256 balBefore = IERC20(STABLE).balanceOf(address(this));
STABLE.safeTransferFrom(msg.sender, address(this), totalValue);
uint256 balAfter = IERC20(STABLE).balanceOf(address(this));
if (balAfter - balBefore != totalValue) revert InsufficientTokenBalance();
```

---

### 5. Update `takeOrder()` - Prevent Self-Taking & Use `_quoteTotalValue()`

**Current:**
```solidity
// Validate
if (order.status != Status.OPEN) revert InvalidStatus();
if (order.allowedTaker != address(0) && order.allowedTaker != msg.sender) revert PrivateOrder();

// Calculate total value
uint256 totalValue = (order.amount * order.unitPrice) / 1e18;
```

**Fixed:**
```solidity
// Validate
if (order.status != Status.OPEN) revert InvalidStatus();
if (order.allowedTaker != address(0) && order.allowedTaker != msg.sender) revert PrivateOrder();

// Prevent maker from taking own order
if (order.isSell && msg.sender == order.seller) revert MakerCannotTakeOwnOrder();
if (!order.isSell && msg.sender == order.buyer) revert MakerCannotTakeOwnOrder();

// Calculate total value
uint256 totalValue = _quoteTotalValue(order.amount, order.unitPrice);
```

**Also add balance-delta checks for all STABLE transfers in `takeOrder()`:**

```solidity
if (order.isSell) {
    // Taking a sell order → become the buyer (post full payment)
    order.buyer = msg.sender;
    order.buyerStable = totalValue;
    
    uint256 balBefore = IERC20(STABLE).balanceOf(address(this));
    STABLE.safeTransferFrom(msg.sender, address(this), totalValue);
    uint256 balAfter = IERC20(STABLE).balanceOf(address(this));
    if (balAfter - balBefore != totalValue) revert InsufficientTokenBalance();
} else {
    // Taking a buy order → become the seller (post collateral based on order's collateralBps)
    order.seller = msg.sender;
    uint256 collateral = (totalValue * order.collateralBps) / 10000;
    order.sellerStable = collateral;
    
    uint256 balBefore = IERC20(STABLE).balanceOf(address(this));
    STABLE.safeTransferFrom(msg.sender, address(this), collateral);
    uint256 balAfter = IERC20(STABLE).balanceOf(address(this));
    if (balAfter - balBefore != collateral) revert InsufficientTokenBalance();
}
```

---

### 6. Update `activateTGE()` - Add Settlement Deadline

**Current:**
```solidity
function activateTGE(bytes32 projectId, uint256 conversionRatio) external onlyOwner {
    if (projectTGE[projectId].isActive) revert TGEAlreadyActive();
    if (conversionRatio == 0 || conversionRatio > MAX_CONVERSION_RATIO) revert InvalidConversionRatio();
    
    projectTGE[projectId] = TGEStatus({
        isActive: true,
        activatedAt: uint64(block.timestamp)
    });
    projectConversionRatio[projectId] = conversionRatio;
    
    emit TGEActivated(projectId, conversionRatio, uint64(block.timestamp));
}
```

**Fixed:**
```solidity
function activateTGE(bytes32 projectId, uint256 conversionRatio) external onlyOwner {
    if (projectTGE[projectId].isActive) revert TGEAlreadyActive();
    if (conversionRatio == 0 || conversionRatio > MAX_CONVERSION_RATIO) revert InvalidConversionRatio();
    
    uint64 activatedAt = uint64(block.timestamp);
    projectTGE[projectId] = TGEStatus({
        isActive: true,
        activatedAt: activatedAt
    });
    projectConversionRatio[projectId] = conversionRatio;
    
    // Set settlement deadline (4 hours after grace period)
    projectSettlementDeadline[projectId] = activatedAt + uint64(GRACE_PERIOD + DEFAULT_SETTLEMENT_WINDOW);
    
    emit TGEActivated(projectId, conversionRatio, activatedAt);
}
```

---

### 7. **CRITICAL:** Fix `settleOrder()` - Add Token Delivery

**Current (BROKEN - NO TOKEN TRANSFER):**
```solidity
function settleOrder(uint256 orderId) external nonReentrant whenNotPaused {
    Order storage order = orders[orderId];
    
    // Validate
    if (order.status != Status.FUNDED) revert InvalidStatus();
    
    TGEStatus memory tge = projectTGE[order.projectId];
    if (!tge.isActive) revert TGENotActive();
    if (block.timestamp <= tge.activatedAt + GRACE_PERIOD) revert GracePeriodNotExpired();
    
    // Get conversion ratio
    uint256 ratio = projectConversionRatio[order.projectId];
    uint256 tokenAmount = (order.amount * ratio) / 1e18;
    
    // Calculate settlement fee (0.5% of stable amount)
    uint256 stableFee = (order.buyerStable * settlementFeeBps) / 10000;
    uint256 stableToSeller = order.buyerStable - stableFee;
    
    // Distribute stable
    STABLE.safeTransfer(order.seller, stableToSeller + order.sellerStable);
    STABLE.safeTransfer(feeCollector, stableFee);
    
    // Mark settled
    order.status = Status.SETTLED;
    emit OrderSettled(orderId, tokenAmount, order.buyerStable);
}
```

**Fixed (WITH TOKEN TRANSFER):**
```solidity
function settleOrder(uint256 orderId) external nonReentrant whenNotPaused {
    Order storage order = orders[orderId];
    
    // Validate
    if (order.status != Status.FUNDED) revert InvalidStatus();
    
    TGEStatus memory tge = projectTGE[order.projectId];
    if (!tge.isActive) revert TGENotActive();
    if (block.timestamp <= tge.activatedAt + GRACE_PERIOD) revert GracePeriodNotExpired();
    
    // Enforce settlement deadline (only for Token projects)
    if (block.timestamp > projectSettlementDeadline[order.projectId]) {
        revert SettlementDeadlinePassed();
    }
    
    // Get token address
    address token = registry.getTokenAddress(order.projectId);
    if (token == address(0)) revert InvalidTokenAddress();
    
    // Get conversion ratio
    uint256 ratio = projectConversionRatio[order.projectId];
    uint256 tokenAmount = (order.amount * ratio) / 1e18;
    
    // Pull tokens from seller (balance-delta guarded)
    uint256 tokenBalBefore = IERC20(token).balanceOf(address(this));
    SafeTransferLib.safeTransferFrom(token, order.seller, address(this), tokenAmount);
    uint256 tokenBalAfter = IERC20(token).balanceOf(address(this));
    if (tokenBalAfter - tokenBalBefore != tokenAmount) revert InsufficientTokenBalance();
    
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
```

---

### 8. Update `cancelOrder()` - Block After Proof Submission

**Current:**
```solidity
// Cannot cancel Points orders once proof is accepted
if (order.status == Status.FUNDED && proofAccepted[orderId]) {
    revert CannotCancelAfterProofAccepted();
}
```

**Fixed:**
```solidity
// Cannot cancel Points orders once proof is submitted (not just accepted)
if (order.status == Status.FUNDED && bytes(proofURIs[orderId]).length > 0) {
    revert CannotCancelAfterProofSubmitted();
}
```

**Also update fee calculation to use `_quoteTotalValue()`:**
```solidity
// Calculate cancellation fee (0.1% of order value)
uint256 totalValue = _quoteTotalValue(order.amount, order.unitPrice);
uint256 cancelFee = (totalValue * cancellationFeeBps) / 10000;
```

---

### 9. Add `handleDefault()` Function

**Add after `cancelOrder()`:**

```solidity
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
        revert SettlementDeadlinePassed(); // Use as "not yet passed"
    }
    
    // Check if this is a Points project with pending proof
    bool isPoints = registry.isPointsProject(order.projectId);
    
    if (isPoints) {
        // Points project - check if proof was submitted but not reviewed
        bool proofSubmitted = bytes(proofURIs[orderId]).length > 0;
        bool proofReviewed = proofAccepted[orderId];
        
        if (proofSubmitted && !proofReviewed) {
            // Proof pending review - extend deadline by 24 hours (one-time grace)
            // Or: split funds 50/50, or: escrow to review queue
            // For now: revert, admin must review
            revert ProofNotAccepted(); // Admin must accept/reject first
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
```

---

### 10. Add Admin Function - `setMaxOrderValue()`

```solidity
/**
 * @notice Set maximum order value
 * @param value Max order value in stable decimals
 */
function setMaxOrderValue(uint256 value) external onlyOwner {
    maxOrderValue = value;
}

/**
 * @notice Extend settlement deadline for a project
 * @param projectId Project identifier
 * @param newDeadline New deadline timestamp
 */
function extendSettlementDeadline(bytes32 projectId, uint64 newDeadline) external onlyOwner {
    TGEStatus memory tge = projectTGE[projectId];
    if (!tge.isActive) revert TGENotActive();
    
    uint64 currentDeadline = projectSettlementDeadline[projectId];
    if (block.timestamp > currentDeadline) revert CannotExtendAfterDeadline();
    if (newDeadline <= currentDeadline) revert InvalidAmount();
    
    projectSettlementDeadline[projectId] = newDeadline;
}
```

---

### 11. Remove Unused Import

**Remove:**
```solidity
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
```

And:
```solidity
using EnumerableSet for EnumerableSet.AddressSet;
```

---

## Testing Checklist

Once all fixes are implemented:

- [ ] Test token settlement with 6-decimal USDC
- [ ] Test token settlement with 18-decimal stable
- [ ] Verify balance-delta checks catch fee-on-transfer tokens
- [ ] Test maker cannot take own order
- [ ] Test order value cap enforcement
- [ ] Test stale proof rejection
- [ ] Test settlement deadline enforcement
- [ ] Test handleDefault() after deadline
- [ ] Test Points project with proof submission → rejection → default
- [ ] Test Points project with proof submission → acceptance → settlement
- [ ] Test Ethos discount tiers (50%, 60%, 70%, 80%, 90%, 100%)
- [ ] Test cancel blocked after proof submission

---

## Summary

**Critical issues remaining:** 11 major fixes needed

**Estimated complexity:** High - requires careful testing especially around decimal handling and token transfers

**Risk level if deployed as-is:** 🚨 **EXTREME** - Guaranteed fund loss

---

**DO NOT DEPLOY until all fixes above are implemented and thoroughly tested.**


