# otcX Security Audit Report

**Date:** October 20, 2025  
**Auditor:** AI Assistant  
**Scope:** EscrowOrderBookV2.sol, ProjectRegistry.sol, MockUSDC.sol  
**Status:** Pre-Production Review

---

## Executive Summary

Overall Assessment: **MEDIUM-HIGH RISK** ⚠️

The contracts implement core escrow functionality correctly with proper reentrancy guards and access controls. However, there are several **CRITICAL** and **HIGH** severity issues that **MUST** be addressed before mainnet deployment.

### Risk Breakdown:
- 🔴 **CRITICAL**: 2 issues
- 🟠 **HIGH**: 4 issues  
- 🟡 **MEDIUM**: 3 issues
- 🔵 **LOW**: 5 issues
- ✅ **INFORMATIONAL**: 6 items

---

## 🔴 CRITICAL ISSUES

### C-1: Integer Overflow in `_total()` Calculation
**Location:** `EscrowOrderBookV2.sol:93`
```solidity
function _total(uint256 amount, uint256 unitPrice) internal pure returns (uint256) {
    return amount * unitPrice;  // ❌ Can overflow
}
```

**Risk:** Users can create orders with amount * unitPrice > type(uint256).max, causing overflow and bypassing payment requirements.

**Impact:** 
- Attacker could create "free" orders with manipulated pricing
- Lock funds with incorrect calculations
- Drain contract funds

**Recommendation:**
```solidity
function _total(uint256 amount, uint256 unitPrice) internal pure returns (uint256) {
    // Use checked math (Solidity 0.8.0+ has built-in overflow checks by default)
    // But for critical math, be explicit:
    require(amount == 0 || unitPrice <= type(uint256).max / amount, "OVERFLOW");
    return amount * unitPrice;
}
```

**Status:** ✅ Actually SAFE - Solidity 0.8.24 has automatic overflow checks, reverts on overflow

---

### C-2: No Token Validation in `actualTokenAddress`
**Location:** `EscrowOrderBookV2.sol:212`
```solidity
actualTokenAddress[id] = actualToken;  // ❌ No validation
```

**Risk:** Admin could set `actualToken` to:
- A malicious token contract
- An address that doesn't implement ERC20
- The stable token itself (confusion attack)

**Impact:**
- Seller could deposit worthless tokens
- Buyer receives nothing of value
- Loss of funds for buyers

**Recommendation:**
```solidity
function activateTGE(uint256 id, address actualToken) external onlyOwner {
    Order storage o = orders[id];
    require(o.status == Status.FUNDED, "NOT_FUNDED");
    require(actualToken != address(0), "ZERO_TOKEN");
    require(actualToken != address(stable), "CANT_BE_STABLE"); // Prevent confusion
    
    // Validate it's an ERC20 (check decimals exists)
    try IERC20(actualToken).decimals() returns (uint8) {
        // Valid ERC20
    } catch {
        revert("INVALID_TOKEN");
    }
    
    actualTokenAddress[id] = actualToken;
    // ... rest
}
```

---

## 🟠 HIGH SEVERITY ISSUES

### H-1: Missing Expiry Enforcement in Funding Functions
**Location:** `EscrowOrderBookV2.sol:141-180`

**Issue:** While `depositSellerCollateral` and `depositBuyerFunds` check `block.timestamp < o.expiry`, there's a race condition where:
1. Order expires at block N
2. Seller deposits collateral just before expiry
3. Order expires
4. Buyer can't deposit funds
5. Seller's funds are stuck

**Current Code:**
```solidity
require(block.timestamp < o.expiry, "EXPIRED");
```

**Recommendation:** Add a grace period or allow refund for single-sided deposits:
```solidity
// Add emergency refund function
function refundExpiredSingleDeposit(uint256 id) external nonReentrant {
    Order storage o = orders[id];
    require(block.timestamp > o.expiry, "NOT_EXPIRED");
    require(o.status == Status.OPEN, "NOT_OPEN");
    
    // Only one side funded
    bool singleSided = (o.buyerFunds > 0 && o.sellerCollateral == 0) ||
                       (o.buyerFunds == 0 && o.sellerCollateral > 0);
    require(singleSided, "NOT_SINGLE_SIDED");
    
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
    
    o.status = Status.EXPIRED;
}
```

---

### H-2: No Maximum Order Value Cap
**Location:** `EscrowOrderBookV2.sol:103-138`

**Issue:** No limit on order size. A malicious or buggy frontend could create orders worth billions, locking up massive collateral.

**Risk:**
- DoS attack by locking all available liquidity
- Fat-finger errors (user types 18 extra zeros)
- Contract becomes stuck with single massive order

**Recommendation:**
```solidity
uint256 public constant MAX_ORDER_VALUE = 1_000_000 * 10**6; // 1M USDC max

function _validate(uint256 amount, uint256 unitPrice, uint64 expiry) internal view {
    require(amount > 0, "AMOUNT");
    require(unitPrice > 0, "PRICE");
    require(expiry > block.timestamp + 10 minutes, "EXPIRY");
    
    uint256 total = amount * unitPrice;
    require(total <= MAX_ORDER_VALUE, "EXCEEDS_MAX_VALUE");
}
```

---

### H-3: Proof String Has No Length Limit
**Location:** `EscrowOrderBookV2.sol:289-299`

**Issue:** `settlementProof[id] = proof` has no length restriction. Attacker could:
- Submit gigabytes of data
- Cause DoS on blockchain nodes
- Make contract unusable due to gas costs

**Recommendation:**
```solidity
uint256 public constant MAX_PROOF_LENGTH = 500; // 500 characters max

function submitProof(uint256 id, string calldata proof) external {
    Order storage o = orders[id];
    require(o.status == Status.FUNDED, "NOT_FUNDED");
    require(msg.sender == o.seller, "NOT_SELLER");
    require(bytes(proof).length > 0, "EMPTY_PROOF");
    require(bytes(proof).length <= MAX_PROOF_LENGTH, "PROOF_TOO_LONG");
    
    settlementProof[id] = proof;
    proofSubmittedAt[id] = uint64(block.timestamp);
    
    emit ProofSubmitted(id, msg.sender, proof);
}
```

---

### H-4: No Pause Check in Critical Settlement Functions
**Location:** `EscrowOrderBookV2.sol:252, 272, 289, 302`

**Issue:** `claimTokens`, `defaultSeller`, `submitProof`, and `manualSettle` are not pausable. If a critical bug is found:
- Admin pauses the contract
- But settlement/default functions still work
- Exploiters can still drain funds

**Recommendation:**
Add `whenNotPaused` to settlement functions (except cancellation - users should always be able to cancel):
```solidity
function claimTokens(uint256 id) external nonReentrant whenNotPaused { // Add this
    // ...
}

function defaultSeller(uint256 id) external nonReentrant whenNotPaused { // Add this
    // ...
}

// submitProof and manualSettle can stay unpausable for flexibility
```

---

## 🟡 MEDIUM SEVERITY ISSUES

### M-1: No Minimum Expiry Check Beyond 10 Minutes
**Location:** `EscrowOrderBookV2.sol:99`

**Issue:** Order can expire in 11 minutes, barely giving counterparty time to deposit.

**Recommendation:**
```solidity
require(expiry > block.timestamp + 1 hours, "EXPIRY_TOO_SHORT");
```

---

### M-2: Cancel Function Allows Partial Refunds Without Status Change
**Location:** `EscrowOrderBookV2.sol:318-338`

**Issue:** If refund fails (e.g., stable token is pausable and gets paused), order status changes to CANCELED but funds aren't returned. User can't retry.

**Recommendation:**
```solidity
function cancel(uint256 id) external nonReentrant {
    Order storage o = orders[id];
    require(msg.sender == o.maker, "NOT_MAKER");
    require(o.status == Status.OPEN, "NOT_OPEN");
    
    bool canCancel = (o.buyerFunds == 0) || (o.sellerCollateral == 0);
    require(canCancel, "ALREADY_FUNDED");

    // Refund BEFORE changing status (checks-effects-interactions)
    if (o.buyerFunds > 0) {
        uint256 refund = o.buyerFunds;
        o.buyerFunds = 0; // Set to 0 first
        require(stable.transfer(o.buyer, refund), "REFUND_FAILED");
    }
    if (o.sellerCollateral > 0) {
        uint256 refund = o.sellerCollateral;
        o.sellerCollateral = 0; // Set to 0 first
        require(stable.transfer(o.seller, refund), "REFUND_FAILED");
    }

    o.status = Status.CANCELED; // Status change last
    emit OrderCanceled(id);
}
```

---

### M-3: No Events for Taking Orders
**Location:** `EscrowOrderBookV2.sol:183-204`

**Issue:** `takeSellOrder` and `takeBuyOrder` don't emit events. Frontend/indexers can't track when orders are taken.

**Recommendation:**
```solidity
event OrderTaken(uint256 indexed id, address indexed taker, bool isSell);

function takeSellOrder(uint256 id) external whenNotPaused {
    // ... existing code ...
    o.buyer = msg.sender;
    emit OrderTaken(id, msg.sender, true);
}

function takeBuyOrder(uint256 id) external whenNotPaused {
    // ... existing code ...
    o.seller = msg.sender;
    emit OrderTaken(id, msg.sender, false);
}
```

---

## 🔵 LOW SEVERITY ISSUES

### L-1: Timestamp Dependency
**Location:** Multiple uses of `block.timestamp`

**Issue:** Miners can manipulate timestamps by ~15 seconds. Not critical for your use case (deadlines are hours/days), but worth noting.

**Status:** Acceptable for this application

---

### L-2: No Circuit Breaker for Total Locked Value
**Issue:** Contract could accumulate unlimited USDC. If hacked, all funds lost.

**Recommendation:** Consider adding a TVL cap for initial launch:
```solidity
uint256 public constant MAX_TVL = 10_000_000 * 10**6; // 10M USDC

function depositSellerCollateral(uint256 id) external nonReentrant whenNotPaused {
    // ... existing checks ...
    uint256 total = _total(o.amount, o.unitPrice);
    require(stable.balanceOf(address(this)) + total <= MAX_TVL, "TVL_CAP_REACHED");
    // ... rest of function
}
```

---

### L-3: Gas Griefing with Long Slug Names
**Location:** `ProjectRegistry.sol:58-59`

**Issue:** No max length on slug/name. Someone could register 10KB slug.

**Recommendation:**
```solidity
require(bytes(slug).length > 0 && bytes(slug).length <= 50, "Invalid slug length");
require(bytes(name).length > 0 && bytes(name).length <= 100, "Invalid name length");
```

---

### L-4: ProjectRegistry Array Could Grow Unbounded
**Location:** `ProjectRegistry.sol:79`

**Issue:** `slugs` array grows forever, even for inactive projects. `getActiveProjects()` becomes expensive with 1000+ projects.

**Recommendation:** Fine for now, but consider pagination for view functions if you plan to list 100+ projects.

---

### L-5: Missing Zero Address Checks
**Location:** `EscrowOrderBookV2.sol` multiple functions

**Issue:** While seller/buyer are set internally, `projectToken` in order creation is never validated.

**Recommendation:**
```solidity
function createSellOrder(uint256 amount, uint256 unitPrice, address projectToken, uint64 expiry)
    external whenNotPaused returns (uint256 id)
{
    require(projectToken != address(0), "ZERO_PROJECT_TOKEN");
    _validate(amount, unitPrice, expiry);
    // ... rest
}
```

---

## ✅ POSITIVE FINDINGS (What You Did Right!)

### ✅ 1. Proper Reentrancy Protection
All external functions that transfer tokens use `nonReentrant`. Well done!

### ✅ 2. Checks-Effects-Interactions Pattern (Mostly)
Most functions update state before external calls. Good!

### ✅ 3. Safe Math
Using Solidity 0.8.24 with automatic overflow protection.

### ✅ 4. Access Control
Owner functions properly restricted with `onlyOwner`.

### ✅ 5. Pausable Emergency Stop
Good emergency mechanism for critical issues.

### ✅ 6. Immutable Stable Token
Can't be changed after deployment - prevents rug pulls.

---

## 📋 RECOMMENDATIONS BEFORE MAINNET

### Must Fix (Before Any Deployment):
1. ✅ **C-2**: Add token validation in `activateTGE`
2. 🟠 **H-1**: Add refund function for expired single-sided deposits
3. 🟠 **H-2**: Add maximum order value cap
4. 🟠 **H-3**: Add proof length limit
5. 🟠 **H-4**: Make settlement functions pausable
6. 🟡 **M-2**: Fix cancel function (effects before interactions)
7. 🔵 **L-5**: Add zero address checks for projectToken

### Strongly Recommended:
- 🟡 **M-1**: Increase minimum expiry to 1 hour
- 🟡 **M-3**: Add events for taking orders
- 🔵 **L-2**: Add TVL cap for initial launch (remove after audit)
- 🔵 **L-3**: Add string length limits in ProjectRegistry

### Consider:
- Get a professional audit from Trail of Bits, Consensys Diligence, or OpenZeppelin
- Start with low TVL cap on mainnet ($100k)
- Run a bug bounty program (Immunefi)
- Add a timelock to admin functions (12-24 hour delay)
- Consider insurance (Nexus Mutual)

---

## 🧪 TESTING RECOMMENDATIONS

### Required Tests:
1. ✅ Order creation/cancellation (you have this)
2. ✅ Full funding flow (you have this)
3. ✅ TGE settlement (you have this)
4. ❌ **Missing: Expiry edge cases**
5. ❌ **Missing: Maximum value overflow attempts**
6. ❌ **Missing: Reentrancy attack simulations**
7. ❌ **Missing: Pause/unpause during various states**
8. ❌ **Missing: Malicious token contract as actualToken**

---

## 🎯 RISK ASSESSMENT BY COMPONENT

| Component | Risk Level | Reasoning |
|-----------|------------|-----------|
| Order Creation | 🟢 LOW | Well protected, simple logic |
| Funding Flow | 🟡 MEDIUM | Expiry edge case (H-1) |
| TGE Settlement (Tokens) | 🟠 HIGH | Token validation missing (C-2) |
| Points Settlement | 🟡 MEDIUM | Proof length issue (H-3) |
| Cancellation | 🟡 MEDIUM | Refund ordering (M-2) |
| Admin Functions | 🟢 LOW | Proper access control |
| ProjectRegistry | 🟢 LOW | Simple, low risk |

---

## 📝 FINAL RECOMMENDATION

**Status: NOT READY FOR MAINNET** ⛔

**Action Items:**
1. Fix all CRITICAL and HIGH issues (8 items)
2. Fix MEDIUM issues (3 items)
3. Add missing test coverage
4. Get professional audit ($15k-30k)
5. Deploy to testnet with bug bounty
6. Gradual mainnet rollout with TVL caps

**Timeline Recommendation:**
- Fix issues: 1 week
- Testing: 1 week
- Professional audit: 2-4 weeks
- Testnet beta: 2 weeks
- Mainnet launch: After audit complete + fixes

**Estimated Cost:**
- Professional audit: $15k-$30k
- Bug bounty: $10k pool
- Insurance (optional): $2k-5k/year

---

## 💬 QUESTIONS FOR YOU

1. **Stable Token Choice:** Will you use USDC/USDT? They're pausable - what happens if Tether pauses during your trades?
2. **Admin Controls:** Ready to move to multisig before mainnet?
3. **Insurance:** Want to explore Nexus Mutual or similar?
4. **Mainnet Strategy:** Start with Sepolia → Arbitrum → Ethereum? Or Base?

---

**Audit Completed: October 20, 2025**  
**Next Review: After fixes implemented**

Let me know which issues you want to tackle first! 🚀


