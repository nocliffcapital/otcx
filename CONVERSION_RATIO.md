# Points-to-Tokens Conversion Ratio

## Overview

The conversion ratio feature allows admins to specify how many tokens should be transferred for each point in a Points project. This is critical because **1 point ≠ 1 token** in most real-world scenarios.

## Contract Changes

### EscrowOrderBookV4.sol

**New State Variable:**
```solidity
mapping(bytes32 => uint256) public projectConversionRatio;
```
- Stores the conversion ratio for each project (18 decimals)
- Example: `1.2e18` means 1 point = 1.2 tokens

**Updated Function:**
```solidity
function activateProjectTGE(
    bytes32 projectId,
    address tokenAddress,
    uint64 settlementWindow,
    uint256 conversionRatio  // NEW PARAMETER
) external onlyOwner
```

**Validation:**
- For **Points projects**: `conversionRatio` can be any positive value (e.g., 1.2, 0.8, 2.5)
- For **Token projects**: `conversionRatio` MUST be `1e18` (1:1 ratio enforced)

**Example Values:**
- `1e18` = 1 point = 1 token (1:1)
- `1.2e18` = 1 point = 1.2 tokens
- `0.8e18` = 1 point = 0.8 tokens
- `2.5e18` = 1 point = 2.5 tokens

## Frontend Changes

### Admin Panel (TGESettlementManager.tsx)

**New Input Field:**
- "Conversion Ratio" input added next to "Token Address"
- For Points projects: accepts any positive decimal (e.g., 1.2)
- For Token projects: locked to 1.0 (disabled input)

**Confirmation Modal:**
Shows the conversion ratio clearly:
- Points: "1 Point = 1.2 Tokens"
- Tokens: "1 Token = 1 Token (1:1)"

### Order Controls (TGEOrderControls.tsx)

**New Contract Read:**
```typescript
const { data: conversionRatio } = useReadContract({
  address: ORDERBOOK_ADDRESS,
  abi: ESCROW_ORDERBOOK_ABI,
  functionName: "projectConversionRatio",
  args: [order.projectToken]
});
```

**Calculation:**
```typescript
const ratio = conversionRatio ? Number(conversionRatio) / 1e18 : 1.0;
const actualTokenAmount = (Number(order.amount) / 1e18) * ratio;
```

**Display Updates:**
- "Amount to Transfer" now shows the **actual token amount** (not the point amount)
- For Points with ratio ≠ 1.0, shows breakdown: "100 points × 1.2 ratio"
- Token approvals and deposits use the `actualTokenAmount`

## Usage Examples

### Example 1: Lighter (Points Project)
- Order: 100 points @ $1 each
- Admin sets conversion ratio: **1.2** (1 point = 1.2 tokens)
- Seller must transfer: **120 tokens** to buyer
- Display: "120 tokens (100 points × 1.2 ratio)"

### Example 2: MegaETH (Token Project)
- Order: 50 tokens @ $10 each
- Admin sets conversion ratio: **1.0** (enforced for token projects)
- Seller must transfer: **50 tokens** to buyer
- Display: "50 tokens"

## Benefits

1. **Flexibility**: Supports any point-to-token conversion ratio
2. **Accuracy**: Ensures sellers transfer the correct amount of tokens
3. **Transparency**: Clearly displays the conversion in the UI
4. **Validation**: Prevents invalid ratios for token projects
5. **Gas Efficiency**: Stored at project level, not per-order

## Testing Checklist

- [ ] Activate TGE for a Points project with ratio 1.2
- [ ] Verify "Amount to Transfer" shows correct token amount
- [ ] Verify proof submission shows correct amount
- [ ] Verify admin can't set ratio ≠ 1.0 for token projects
- [ ] Verify conversion ratio displays correctly in confirmation modal
- [ ] Verify token approval requests correct amount
- [ ] Test with various ratios: 0.5, 1.0, 1.5, 2.0

## Notes

- The conversion ratio is **immutable** once TGE is activated
- All calculations use 18 decimals for precision
- The ratio applies to ALL orders in the project
- For Points projects without on-chain tokens, the ratio still applies to the off-chain transfer amount

