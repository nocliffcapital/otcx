# Token Address Strategy for otcX

## The Problem
Projects might not have deployed tokens when trading starts:
- **Points projects**: Token doesn't exist until TGE
- **Token projects**: Token might not be deployed yet or address unknown

## The Solution: Two-Address System

### 1. Placeholder Address (Deterministic & Immutable)
**Used for:** Creating orders, matching in orderbook
**Format:** Derived from project slug (e.g., "lighter" → `0x000000000000000000000000000000006C696768`)
**Never changes:** All orders reference this address

### 2. Actual Token Address (Set at TGE)
**Used for:** Token transfers during settlement
**Format:** Real ERC20 contract address
**Set when:** Admin activates TGE with `activateTGE(orderId, actualTokenAddress)`

## Complete Flow

### Phase 1: Project Creation
```solidity
// Admin creates project with deterministic placeholder
registry.addProject(
    "lighter",
    "Lighter",
    0x000000000000000000000000000000006C696768,  // ← Placeholder
    "Points",
    ...
);
```

### Phase 2: Trading (Pre-TGE)
```solidity
// Users create orders with the placeholder address
createSellOrder(
    amount: 100,
    unitPrice: 2e6,
    projectToken: 0x000000000000000000000000000000006C696768  // ← Same placeholder
);
```

**✓ Orders are created**
**✓ Collateral is locked**
**✓ Trading happens**

### Phase 3: TGE Happens (Token Launches)
```solidity
// Admin activates TGE with ACTUAL token address
activateTGE(
    orderId: 1,
    actualToken: 0x1234567890123456789012345678901234567890  // ← Real token!
);
```

**The contract stores:** `actualTokenAddress[1] = 0x1234...`

### Phase 4: Settlement
- **Token projects**: Seller deposits actualTokenAddress to contract
- **Points projects**: Seller sends actualTokenAddress to buyer, submits proof, admin settles

## Key Rules

### ✅ DO:
1. Use deterministic placeholder addresses for ALL projects initially
2. Keep placeholder address in registry (never change it)
3. Provide actual token address only during `activateTGE`
4. Match orders by placeholder address

### ❌ DON'T:
1. Change the tokenAddress in the registry after orders exist
2. Use random placeholder addresses
3. Try to update order's projectToken field (it's immutable)

## Generating Deterministic Addresses

```javascript
// Convert project slug to address
function slugToAddress(slug: string): string {
  const hex = Buffer.from(slug).toString('hex').padEnd(40, '0');
  return `0x${hex.slice(0, 40)}`;
}

// Examples:
slugToAddress("lighter")     // 0x000000000000000000000000000000006C696768
slugToAddress("extended")    // 0x0000000000000000000000000000657874656E64
slugToAddress("pacifica")    // 0x0000000000000000000000000000007061636966
```

## Smart Contract Support

The contract already supports this! Check `EscrowOrderBookV2.sol`:

```solidity
struct Order {
    ...
    address projectToken;  // ← Immutable placeholder
    ...
}

// Separate mapping for actual tokens
mapping(uint256 => address) public actualTokenAddress;  // ← Set at TGE

function activateTGE(uint256 id, address actualToken) external onlyOwner {
    actualTokenAddress[id] = actualToken;  // ← Store real address
    ...
}
```

## For Production

Consider these improvements:

1. **Validate placeholder format** in registry (must be deterministic)
2. **Prevent token address changes** once orders exist
3. **Auto-generate placeholders** from slug in UI
4. **Show both addresses** in UI: "Placeholder: 0x...6C69 | Actual: TBD"
5. **Verify actual token** is valid ERC20 before activating TGE

## Current Issue & Fix

**Problem:** Lighter's registry address was changed from `0x...6C696768` to `0x1234...`
**Result:** Existing order (created with `0x...6C696768`) doesn't match registry anymore
**Fix:** Change registry back to `0x...6C696768`, then use `actualTokenAddress` for TGE

---

**Remember:** The registry's `tokenAddress` is for **matching/filtering orders**. The `actualTokenAddress` is for **settlement/transfers**.

