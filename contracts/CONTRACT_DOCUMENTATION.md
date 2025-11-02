# EscrowOrderBookV4 - Contract Documentation

## Overview

`EscrowOrderBookV4` is a decentralized escrow system for trading pre-TGE token allocations. It supports both on-chain ERC20 tokens and off-chain points systems with comprehensive security measures.

---

## Architecture

### Order Lifecycle

```
1. CREATE ORDER (OPEN)
   ├─ Maker locks collateral
   ├─ Order visible to counterparties
   └─ Status: OPEN

2. TAKE ORDER (FUNDED)
   ├─ Counterparty locks collateral
   ├─ Both parties fully collateralized
   └─ Status: FUNDED

3. SETTLEMENT (SETTLED)
   ├─ TGE activated by admin
   ├─ Settlement window begins (4 hours default)
   ├─ Tokens/Proof delivered
   └─ Status: SETTLED
```

### Alternative Paths

- **CANCELED**: Maker cancels order (0.1% fee)
- **DEFAULTED**: Seller fails to deliver (buyer compensated)

---

## Project Types

### Token Projects

**Characteristics:**
- On-chain ERC20 tokens
- Must have 18 decimals
- Conversion ratio: Always 1:1 (1e18)
- Permissionless settlement (anyone can trigger)

**Settlement Flow:**
1. Admin activates TGE with token address
2. Settlement window starts (4 hours default)
3. **Anyone** can call `settleOrder(orderId)`
4. Contract pulls tokens from seller
5. Distributes tokens to buyer (minus fee)
6. Distributes stable to seller (minus fee)
7. Collects fees (0.5% stable + 0.5% token)

**Code Path:**
```solidity
settleOrder(orderId) → Token transfer → Distribution → SETTLED
```

### Points Projects

**Characteristics:**
- Off-chain points systems
- Conversion ratio: Configurable (e.g., 1.2e18 = 1 point → 1.2 tokens)
- Requires proof submission
- Admin verification before settlement

**Settlement Flow:**
1. Admin activates TGE with `POINTS_SENTINEL` address
2. Settlement window starts (4 hours default)
3. **Seller** submits proof before deadline (IPFS hash/transaction proof)
4. **Admin** reviews and accepts/rejects after deadline
5. **Anyone** can call `settleOrderManual(orderId)` after:
   - Proof accepted
   - Settlement deadline passed
6. Distributes stable to seller (minus fee)
7. Collects fee (0.5% of total collateral)

**Code Path:**
```solidity
submitProof(orderId, proof) → acceptProof(orderId) → settleOrderManual(orderId) → SETTLED
```

---

## Security Features

### Reentrancy Protection

**Implementation:**
- All state-changing functions use `nonReentrant` modifier
- Checks-Effects-Interactions pattern enforced
- State updated BEFORE external calls

**Protected Functions:**
- `createOrder()`, `takeOrder()`, `settleOrder()`, `settleOrderManual()`
- `cancelOrder()`, `handleDefault()`

### Fee-on-Transfer Protection

**Implementation:**
- Balance-delta checks on all token deposits
- Validates exact amount received matches expected

**Example:**
```solidity
uint256 balBefore = stable.balanceOf(address(this));
address(stable).safeTransferFrom(msg.sender, address(this), collateral);
uint256 balAfter = stable.balanceOf(address(this));
if (balAfter - balBefore != collateral) revert InvalidAmount();
```

### Access Control

**Self-Take Prevention:**
```solidity
if (order.maker == msg.sender) revert NotAuthorized();
```

**Proof Submission:**
- Only seller can submit proof
- Only buyer can accept proof (early acceptance)
- Only admin can accept/reject after deadline

**Deadline Enforcement:**
- Proof submission: Must be before deadline (prevents griefing)
- Settlement: Must be after deadline (enforces timing)
- Default handling: Only after deadline

### Arithmetic Safety

**Fee Calculations:**
- All fees use floor division (rounds down)
- Maximum fee: 5% (500 bps)
- Default: 0.5% settlement, 0.1% cancellation

**Underflow Protection:**
- Fees capped at 5% of amounts
- Safety checks prevent fee > refund scenarios
- Solidity 0.8+ built-in overflow/underflow protection

---

## Fee System

### Settlement Fees

**Token Projects:**
- Stable fee: 0.5% of buyer funds
- Token fee: 0.5% of actual token amount
- Total: 0.5% stable + 0.5% token

**Points Projects:**
- Fee: 0.5% of total collateral (buyerFunds + sellerCollateral)
- No token fee (off-chain transfer)

### Cancellation Fees

- Fee: 0.1% of order value
- Charged to order maker
- Counterparty receives full refund (no fee)

### Fee Collection

- Fees collected on settlement/cancellation
- Sent to `feeCollector` address (immutable)
- Emits `FeeCollected` event

---

## Conversion Ratios

### Token Projects

**Enforcement:**
- Must be exactly 1e18 (1:1 ratio)
- Enforced on activation (line 262)
- Enforced during grace period updates (line 310)

**Example:**
```solidity
// Always 1:1 for tokens
conversionRatio = 1e18; // 1 token = 1 token
actualTokenAmount = order.amount; // No conversion
```

### Points Projects

**Flexibility:**
- Can be any positive value
- Examples:
  - 1.2e18 = 1 point → 1.2 tokens
  - 0.8e18 = 1 point → 0.8 tokens
  - 10e18 = 1 point → 10 tokens (max)

**Grace Period:**
- 1 hour after TGE activation
- Admin can correct ratio mistakes
- Prevents permanent errors

**Calculation:**
```solidity
actualTokenAmount = (order.amount * conversionRatio) / 1e18
```

---

## Settlement Windows

### Timeline

```
TGE Activation (t0)
  ↓
Grace Period (1 hour)
  ↓
Settlement Window Opens (t0 + 1 hour)
  ↓
Proof Submission Deadline (t0 + 1 hour + window)
  ↓
Admin Review Period
  ↓
Settlement Available (after deadline)
```

### Default Configuration

- **Grace Period**: 1 hour (fixed)
- **Settlement Window**: 4 hours (default, configurable)
- **Max Window**: 7 days

### Deadline Enforcement

**Proof Submission:**
```solidity
// Must submit BEFORE deadline
if (block.timestamp > projectSettlementDeadline[order.projectId]) {
    revert DeadlinePassed();
}
```

**Settlement:**
```solidity
// Must settle AFTER deadline (for points)
if (block.timestamp <= projectSettlementDeadline[order.projectId]) {
    revert InvalidStatus();
}
```

---

## Order States

### Status Enum

```solidity
enum Status {
    OPEN,       // Order created, awaiting counterparty
    FUNDED,     // Both parties locked collateral
    SETTLED,    // Complete - tokens delivered
    DEFAULTED,  // Seller defaulted, buyer compensated
    CANCELED    // Order canceled by maker
}
```

### State Transitions

**Normal Flow:**
```
OPEN → FUNDED → SETTLED
```

**Cancellation:**
```
OPEN → CANCELED
FUNDED → CANCELED (if proof not accepted)
```

**Default:**
```
FUNDED → DEFAULTED (after deadline, no proof or rejected)
```

### State Checks

**Settlement:**
```solidity
require(order.status == Status.FUNDED);
require(projectTgeActivated[order.projectId]);
```

**Cancellation:**
```solidity
require(order.status == Status.OPEN || order.status == Status.FUNDED);
require(!proofAccepted[orderId]); // Cannot cancel after proof accepted
```

---

## Key Functions

### Order Creation

```solidity
function createOrder(
    bytes32 projectId,
    uint256 amount,
    uint256 unitPrice,
    bool isSell,
    address allowedTaker  // address(0) = public
) external returns (uint256 orderId)
```

**Requirements:**
- Project must be active in registry
- Project TGE not yet activated
- Order value: $100 - $1M
- Maker locks collateral

### Taking Orders

```solidity
function takeOrder(uint256 orderId) external
```

**Requirements:**
- Order status: OPEN
- Maker cannot take own order
- Private orders: only allowedTaker
- Counterparty locks collateral

### Token Settlement (Permissionless)

```solidity
function settleOrder(uint256 orderId) external
```

**Requirements:**
- Order status: FUNDED
- TGE activated
- Before settlement deadline
- Token project (not points)

**Actions:**
1. Pulls tokens from seller
2. Transfers tokens to buyer (minus fee)
3. Transfers stable to seller (minus fee)
4. Collects fees

### Points Settlement (Proof-Based)

```solidity
// Step 1: Seller submits proof
function submitProof(uint256 orderId, string calldata proof) external

// Step 2: Admin accepts (or buyer accepts early)
function acceptProof(uint256 orderId) external onlyOwner
function acceptProofAsBuyer(uint256 orderId) external

// Step 3: Anyone settles
function settleOrderManual(uint256 orderId) external
```

**Requirements:**
- Proof submitted before deadline
- Proof accepted (admin or buyer)
- Settlement deadline passed
- Points project only

### Cancellation

```solidity
function cancelOrder(uint256 orderId) external
```

**Requirements:**
- Order maker only
- Status: OPEN or FUNDED
- Proof not accepted

**Fee:**
- 0.1% of order value
- Counterparty gets full refund
- Maker gets refund minus fee

### Default Handling

```solidity
function handleDefault(uint256 orderId) external
```

**Requirements:**
- After settlement deadline
- No proof submitted OR proof rejected
- Order status: FUNDED

**Compensation:**
- Buyer receives all collateral (buyerFunds + sellerCollateral)

---

## Admin Functions

### TGE Activation

```solidity
function activateProjectTGE(
    bytes32 projectId,
    address tokenAddress,  // ERC20 or POINTS_SENTINEL
    uint64 settlementWindow,  // Seconds (max 7 days)
    uint256 conversionRatio    // 1e18 for tokens, variable for points
) external onlyOwner
```

**Validations:**
- Token projects: Must have 18 decimals, non-zero supply
- Token projects: Conversion ratio must be 1e18
- Points projects: Can use any conversion ratio
- Settlement window: 1 second to 7 days

### Fee Configuration

```solidity
function setSettlementFee(uint64 newFeeBps) external onlyOwner  // 0-500 (0-5%)
function setCancellationFee(uint64 newFeeBps) external onlyOwner  // 0-500 (0-5%)
```

### Proof Management

```solidity
function acceptProof(uint256 orderId) external onlyOwner
function acceptProofBatch(uint256[] calldata orderIds) external onlyOwner
function rejectProof(uint256 orderId, string calldata reason) external onlyOwner
```

**Timing:**
- Accept/reject only after settlement deadline
- Batch operations for efficiency

### Emergency Controls

```solidity
function pause() external onlyOwner
function unpause() external onlyOwner
```

**Impact:**
- Pause: Blocks `createOrder()` and `takeOrder()`
- Settlement/cancellation/default remain callable (allows exits)

---

## Events

### Order Events

```solidity
event OrderCreated(uint256 indexed id, address indexed maker, bool isSell, ...)
event OrderFunded(uint256 indexed id, address buyer, address seller)
event OrderSettled(uint256 indexed id, address buyer, address seller, ...)
event OrderCanceled(uint256 indexed id, uint256 fee)
event OrderDefaulted(uint256 indexed id, address compensated, uint256 amount)
```

### Project Events

```solidity
event ProjectTGEActivated(bytes32 indexed projectId, address tokenAddress, ...)
event SettlementExtended(bytes32 indexed projectId, uint64 newDeadline)
event ConversionRatioUpdated(bytes32 indexed projectId, uint256 oldRatio, uint256 newRatio)
```

### Proof Events

```solidity
event ProofSubmitted(uint256 indexed id, address seller, string proof)
event ProofAccepted(uint256 indexed id, address indexed admin)
event ProofRejected(uint256 indexed id, address indexed admin, string reason)
```

### Fee Events

```solidity
event FeeCollected(bytes32 indexed projectId, address token, uint256 amount)
event SettlementFeeUpdated(uint64 oldRate, uint64 newRate)
event CancellationFeeUpdated(uint64 oldRate, uint64 newRate)
```

---

## Error Handling

### Common Errors

```solidity
error ContractPaused()           // Contract is paused
error NotAuthorized()            // Unauthorized action
error InvalidAmount()            // Invalid amount
error InvalidStatus()            // Wrong order status
error TGENotActivated()         // TGE not activated
error TGEAlreadyActivated()      // TGE already activated
error DeadlinePassed()          // Settlement deadline passed
error OrderValueTooLow()        // Order below minimum
error ExceedsMaxValue()         // Order above maximum
```

---

## Security Considerations

### Recent Fixes (Applied)

1. **Proof Submission Griefing** ✅
   - Added deadline check to `submitProof()`
   - Prevents sellers from locking buyer funds with fake proofs

2. **Early Settlement Bypass** ✅
   - Added deadline check to `settleOrderManual()`
   - Enforces protocol timing guarantees

3. **Conversion Ratio Safety** ✅
   - Token projects enforced to 1e18 ratio
   - Points projects use configurable ratio with grace period

### Ongoing Protections

- Reentrancy guards on all external interactions
- Balance-delta checks prevent fee-on-transfer tokens
- Self-take prevention
- State transition validation
- Arithmetic overflow/underflow protection (Solidity 0.8+)

---

## Gas Optimization

### Design Choices

- **Project-level TGE**: Single flag per project (not per-order)
- **Batch Operations**: Admin can accept multiple proofs in one tx
- **State Cleanup**: Proof state deleted after settlement (gas refund)
- **Immutable Variables**: Critical addresses set in constructor

### Gas Costs (Estimated)

- `createOrder()`: ~100k gas
- `takeOrder()`: ~80k gas
- `settleOrder()`: ~150k gas (token project)
- `settleOrderManual()`: ~100k gas (points project)
- `cancelOrder()`: ~60k gas

---

## Testing

### Test Coverage

```bash
cd contracts
forge test -vvv
```

### Key Test Scenarios

1. Order creation and taking
2. Token project settlement
3. Points project proof flow
4. Cancellation with fees
5. Default handling
6. Deadline enforcement
7. Griefing attack prevention
8. Early settlement prevention

---

## Deployment

### Constructor Parameters

```solidity
constructor(
    address stableToken,      // Stablecoin address (USDC, USDT, etc.)
    address _feeCollector,    // Fee collection address
    address _registry         // ProjectRegistryV2 address
)
```

### Deployment Script

```bash
forge script script/DeployV4.s.sol --rpc-url sepolia --broadcast --verify
```

---

## Version History

### V4 Improvements

- Project-level TGE activation (no per-order tracking)
- Permissionless settlement for token projects
- Split fee system (stable + token)
- Conversion ratio support for points projects
- Grace period for ratio corrections
- Deadline enforcement for proof submission/settlement
- Security fixes for griefing and timing bypass

---

## Links

- **Contract**: `0x1560B643159F2184B9b416D822fAc1A05769af2F` (Sepolia)
- **Registry**: `0x7fdBE0DEA92E1e246276DCb50c6d7Dc910563D22` (Sepolia)
- **Network**: Ethereum Sepolia Testnet
- **Explorer**: [Etherscan](https://sepolia.etherscan.io/address/0x1560B643159F2184B9b416D822fAc1A05769af2F)

