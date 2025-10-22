# V4 Contract Addresses (100% Collateral Fix)

**Date:** $(date)

## Sepolia Testnet Deployment

```
NEXT_PUBLIC_REGISTRY=0xC6077E2c33dCEc1C36D3eEe59aEc0991F97e0619
NEXT_PUBLIC_ORDERBOOK=0xdAdac9132d5c02e382f9A3069E2C6b2951A07C9E
NEXT_PUBLIC_STABLE=0x22c585Ea2fC9d5B39398f119b77d58c1099d17eF
NEXT_PUBLIC_STABLE_DECIMALS=6
NEXT_PUBLIC_USDT=0xF5559BcA2C53d368910B1d0E4012BD7d49E723Da
```

## Changes in This Deployment

### Fixed: 100% Collateral for All Orders

**Before:**
- Sellers: 110% collateral (extra 10%)
- Buyers: 100% collateral

**After:**
- Sellers: 100% collateral ✅
- Buyers: 100% collateral ✅

### Why This Change?

User feedback: "we never discussed 110%"
- Simpler to understand
- Fair for both parties
- Less capital intensive for sellers

## Action Required

1. Update `frontend/.env.local` with new addresses above
2. Restart dev server: `npm run dev`
3. Test order creation - should now require exact trade value as collateral

## Contract Details

- **MockUSDC:** 0x22c585Ea2fC9d5B39398f119b77d58c1099d17eF
- **MockUSDT:** 0xF5559BcA2C53d368910B1d0E4012BD7d49E723Da
- **Registry:** 0xC6077E2c33dCEc1C36D3eEe59aEc0991F97e0619
- **Orderbook:** 0xdAdac9132d5c02e382f9A3069E2C6b2951A07C9E
- **Fee Collector:** 0x61fEDd6BC4ef1ab11cf8b6CC8F9b4Faeb41B6f55

## Example

Creating a $100 sell order:
- **Before:** Required $110 USDC collateral
- **After:** Requires $100 USDC collateral ✅
