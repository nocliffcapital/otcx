# Points Settlement Flow

## Overview

Points projects represent **pre-TGE OTC trading** where the actual tokens don't exist yet. When the TGE (Token Generation Event) happens, the admin activates the settlement window, and parties must complete the trade.

## Key Difference: Points vs Tokens

### Token Projects (Standard Flow)
1. Order FUNDED (both parties lock collateral)
2. Admin activates TGE → Opens 4-hour settlement window
3. **Seller deposits tokens to CONTRACT**
4. **Buyer claims tokens from CONTRACT**
5. Contract automatically releases payments

### Points Projects (Manual Settlement Flow)
1. Order FUNDED (both parties lock collateral)
2. Admin activates TGE → Opens 4-hour settlement window
3. **Seller sends tokens DIRECTLY to buyer** (off-chain or on-chain)
4. **Seller submits PROOF** to contract (tx hash, screenshot, etc.)
5. **Admin verifies proof and manually settles**
6. Contract releases seller's collateral + buyer's payment → Seller gets paid
7. Buyer already has tokens (received directly from seller)

## Why This Approach?

For pre-TGE OTC deals:
- **Trust-minimized escrow**: Both parties lock collateral upfront (FUNDED status)
- **Flexible settlement**: Tokens can be sent via any method (centralized exchange, direct transfer, etc.)
- **Admin verification**: Human review of proof before releasing funds
- **Protection**: Admin can extend settlement window or handle disputes

## Smart Contract Functions

### For Token Projects
```solidity
activateTGE(orderId, actualTokenAddress)  // Admin activates
depositSellerTokens(orderId, amount)      // Seller deposits to contract
claim(orderId)                            // Buyer claims from contract
```

### For Points Projects
```solidity
activateTGE(orderId, actualTokenAddress)  // Admin activates (same as Tokens)
submitProof(orderId, proof)               // Seller submits proof string
manualSettle(orderId)                     // Admin manually settles after verifying proof
```

## UI Flow in Admin Panel

When managing a Points project, the admin sees:

1. **Before TGE**: All FUNDED orders with "Activate TGE" button
2. **After TGE Activation**: Active settlement window with:
   - Extension buttons (+4h, +24h)
   - Proof submission status
   - "Verify & Settle" button (enabled when proof is submitted)

## Settlement Window Management

- Initial window: 4 hours
- Admin can extend: +4 hours or +24 hours at a time
- Extension prevents default and gives parties more time
- Good for:
  - Blockchain congestion
  - Centralized exchange delays
  - Coordination issues

## Proof Format

The proof string can be anything that helps admin verify:
- Transaction hash: `0x123abc...`
- Screenshot URL: `https://example.com/proof.png`
- CEX transfer ID: `Binance-123456`
- Multiple proofs: `tx:0x123,screenshot:url,notes:sent via OKX`

Admin reviews this proof off-chain before calling `manualSettle()`.

## Future Enhancements

Potential improvements for production:
1. **Multi-sig admin**: Require multiple admins to approve settlements
2. **Dispute resolution**: Allow buyer to challenge proof within timeframe
3. **Automatic verification**: For on-chain transfers, verify tx automatically
4. **Reputation integration**: Track successful settlements for trust scores
5. **Insurance fund**: Pool to handle edge cases and disputes

## Security Considerations

1. **Admin trust**: Manual settlement requires trusting the admin to verify correctly
2. **Proof authenticity**: Screenshots can be faked - cross-reference with blockchain when possible
3. **Timing attacks**: Admin must act within settlement window to prevent defaults
4. **Front-running**: Admin transactions are public - consider using private mempools for large settlements

---

**Note**: This flow is designed for high-value, low-frequency OTC deals where human verification adds security rather than friction.

