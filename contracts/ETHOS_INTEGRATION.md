# Ethos Integration - Partial Collateral System

**Status:** 🧪 EXPERIMENTAL (Not deployed, not on GitHub)

## Overview

This experimental feature integrates Ethos reputation scores to enable **sellers to post partial collateral** (40%-100%) instead of always requiring 100%. The system uses EIP-712 signatures to verify reputation scores on-chain, preventing abuse while maintaining decentralization.

---

## Key Features

### 1. **Reputation-Based Collateral** (Aligned with Ethos Tiers)
**Clean 10% Increments** for easy understanding:
- **Renowned (2600+)**: 50% collateral (50% saving) 🏆
- **Revered (2400-2599)**: 60% collateral (40% saving) 💎
- **Distinguished (2200-2399)**: 70% collateral (30% saving) ⭐
- **Exemplary (2000-2199)**: 80% collateral (20% saving) ✨
- **Reputable (1800-1999)**: 90% collateral (10% saving) 🌟
- **Established (1600-1799)**: 100% collateral (no discount) 🔵
- **Known (1400-1599)**: 100% collateral (no discount) 🟢
- **Neutral (1200-1399)**: 100% collateral (no discount) 🟡
- **Questionable (800-1199)**: 100% collateral (no discount) 🟠
- **Untrusted (0-799)**: 100% collateral (no discount) 🔴

### 2. **Security Guardrails**
- ✅ **Hard floor**: Never below 50% collateral (owner-configurable down to 40%)
- ✅ **Signature verification**: EIP-712 ECDSA signatures from trusted signer
- ✅ **Replay protection**: Nonce tracking per wallet
- ✅ **Expiry check**: Scores expire after defined period (e.g., 7 days)
- ✅ **Chain binding**: Signatures tied to specific chain ID
- ✅ **Opt-out mechanism**: Sellers can choose 100% collateral
- ✅ **Circuit breakers**: Global and per-project emergency disable

### 3. **Risk Management**
- **Buyers protected**: Minimum collateral floor ensures skin in the game
- **Default penalties**: Full collateral + fees go to buyer on seller default
- **Project-level control**: Owners can enable/disable per project
- **Tier flexibility**: Owner can adjust score→collateral mappings

---

## How It Works

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  SELLER CREATES SELL ORDER                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │ Toggle Ethos Option? │
                   └─────────────────────┘
                    │                  │
              NO ┌──┘                  └──┐ YES
                 ▼                        ▼
     ┌────────────────────┐    ┌─────────────────────┐
     │ Post 100% Collat.  │    │ Fetch Ethos Score   │
     │  (Standard Flow)   │    │  from API/Service   │
     └────────────────────┘    └─────────────────────┘
                                        │
                                        ▼
                              ┌──────────────────────┐
                              │ API Returns:         │
                              │ - score              │
                              │ - issuedAt           │
                              │ - expiry             │
                              │ - nonce (unique)     │
                              │ - signature (EIP-712)│
                              └──────────────────────┘
                                        │
                                        ▼
                         ┌─────────────────────────────┐
                         │ Frontend calls createOrder() │
                         │ with ScoreProof struct       │
                         └─────────────────────────────┘
                                        │
                                        ▼
                            ┌─────────────────────┐
                            │ Contract validates: │
                            │ ✓ Signature valid   │
                            │ ✓ Not expired       │
                            │ ✓ Nonce not used    │
                            │ ✓ Chain ID matches  │
                            │ ✓ Ethos enabled     │
                            └─────────────────────┘
                                        │
                                        ▼
                              ┌──────────────────┐
                              │ Calculate:       │
                              │ - Tier from score│
                              │ - Apply floor    │
                              │ - % collateral   │
                              └──────────────────┘
                                        │
                                        ▼
                      ┌────────────────────────────────┐
                      │ Seller posts partial collateral │
                      │ (e.g., 50% instead of 100%)    │
                      └────────────────────────────────┘
```

---

## Smart Contract Changes

### New Structs

```solidity
struct ScoreProof {
    uint256 score;        // Ethos score (0-2800+ scale)
    uint64  issuedAt;     // Unix timestamp
    uint64  expiry;       // Expires after N days
    bytes32 nonce;        // Unique per issuance
    bytes   signature;    // EIP-712 ECDSA sig
}
```

### New State Variables

```solidity
address public ethosSigner;                           // Trusted signer
uint16 public ethosFloorBps = 5000;                   // 50% floor
mapping(uint256 => uint16) public tierBps;            // score → collateral%
uint256[] public tierCutoffs;                         // [1800, 2000, 2200, 2400, 2600]
mapping(address => mapping(bytes32 => bool)) public usedNonces; // Replay protection
mapping(bytes32 => bool) public projectEthosEnabled; // Per-project toggle
bool public ethosGloballyEnabled = true;              // Global circuit breaker
```

### Updated Order Struct

```solidity
struct Order {
    // ... existing fields ...
    uint16 collateralBps;   // NEW: Actual collateral % used (5000-10000)
}
```

---

## Function Reference

### Core Functions

#### `createOrder(..., bool useEthos, ScoreProof calldata proof)`
- **New parameters**:
  - `useEthos`: Set to `true` to apply Ethos discount
  - `proof`: Score proof with signature
- **Behavior**:
  - If `useEthos = false`: Standard 100% collateral
  - If `useEthos = true`: Validates proof and applies discount

#### `_verifyScoreProof(address wallet, ScoreProof proof)`
- Validates EIP-712 signature
- Checks expiry, chain ID, and nonce
- Reverts if invalid

#### `_collateralBpsForScore(uint256 score)`
- Maps score to collateral basis points
- Applies hard floor (never below `ethosFloorBps`)

### Admin Functions

#### `setEthosSigner(address signer)`
- Set trusted signer for score proofs
- Recommended: Use multisig or secure EOA

#### `setEthosFloorBps(uint16 bps)`
- Set minimum collateral percentage
- Range: 4000-10000 (40%-100%)

#### `setEthosTiers(uint256[] cutoffs, uint16[] bps)`
- Update tier configuration
- Example: `[1800, 2000, 2200, 2400, 2600]` → `[9000, 8000, 7000, 6000, 5000]`
- **Clean 10% increments**: 90%, 80%, 70%, 60%, 50%

#### `setProjectEthosEnabled(bytes32 projectId, bool enabled)`
- Enable/disable Ethos for specific project

#### `setEthosGloballyEnabled(bool enabled)`
- Global circuit breaker (emergency disable)

### View Functions

#### `previewCollateralBps(uint256 score)`
- Preview collateral requirement for given score
- Useful for UI before transaction

#### `getEthosTiers()`
- Returns current tier configuration

#### `isNonceUsed(address wallet, bytes32 nonce)`
- Check if nonce has been used

---

## Frontend Integration

### 1. **UI Toggle**
```tsx
<Switch
  label="Use Ethos Reputation Discount"
  checked={useEthos}
  onChange={setUseEthos}
/>
{useEthos && (
  <p>Your score: {score} → {discount}% collateral</p>
)}
```

### 2. **Fetch Score Proof**
```typescript
// Backend API call (server-side)
const fetchScoreProof = async (wallet: string) => {
  // Option A: Official Ethos API (if they provide signatures)
  const response = await fetch(`https://api.ethos.network/score`, {
    method: 'POST',
    body: JSON.stringify({ wallet }),
  });
  
  // Returns: { score, issuedAt, expiry, nonce, signature }
  return response.json();
};

// Option B: Your own attester service
const fetchScoreProof = async (wallet: string) => {
  // 1. Call Ethos API to get score
  const ethosScore = await fetch(`https://api.ethos.network/score/${wallet}`);
  
  // 2. Your backend signs EIP-712 message
  const response = await fetch(`/api/attest-score`, {
    method: 'POST',
    body: JSON.stringify({ wallet, score: ethosScore.score }),
  });
  
  return response.json();
};
```

### 3. **Create Order with Proof**
```typescript
const { writeContract } = useWriteContract();

const handleCreateOrder = async () => {
  let proof = {
    score: 0,
    issuedAt: 0,
    expiry: 0,
    nonce: ethers.ZeroHash,
    signature: "0x",
  };
  
  if (useEthos) {
    // Fetch score proof from backend
    proof = await fetchScoreProof(address);
  }
  
  await writeContract({
    address: ORDERBOOK_ADDRESS,
    abi: ORDERBOOK_ABI,
    functionName: "createOrder",
    args: [
      projectId,
      amount,
      unitPrice,
      true, // isSell
      allowedTaker,
      useEthos,
      proof,
    ],
  });
};
```

---

## Backend Implementation

### Option A: Official Ethos API (Preferred)
If Ethos provides signed score proofs:
```typescript
// Simply proxy the request
app.post('/api/ethos-proof', async (req, res) => {
  const { wallet } = req.body;
  const ethosResponse = await fetch(`https://api.ethos.network/proof`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${ETHOS_API_KEY}` },
    body: JSON.stringify({ wallet }),
  });
  
  res.json(await ethosResponse.json());
});
```

### Option B: Your Own Attester (Fallback)
If Ethos doesn't provide signatures:
```typescript
import { ethers } from 'ethers';

const DOMAIN = {
  name: "EscrowOrderBookV4_Ethos",
  version: "1",
  chainId: 11155111, // Sepolia
  verifyingContract: ORDERBOOK_ADDRESS,
};

const TYPES = {
  EthosScore: [
    { name: "wallet", type: "address" },
    { name: "score", type: "uint256" },
    { name: "issuedAt", type: "uint64" },
    { name: "expiry", type: "uint64" },
    { name: "nonce", type: "bytes32" },
    { name: "chainId", type: "uint256" },
  ],
};

app.post('/api/attest-score', async (req, res) => {
  const { wallet } = req.body;
  
  // 1. Fetch score from Ethos
  const ethosResponse = await fetch(`https://api.ethos.network/score/${wallet}`);
  const { score } = await ethosResponse.json();
  
  // 2. Generate proof
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiry = issuedAt + (7 * 24 * 60 * 60); // 7 days
  const nonce = ethers.keccak256(ethers.toUtf8Bytes(`${wallet}-${Date.now()}`));
  
  const value = {
    wallet,
    score,
    issuedAt,
    expiry,
    nonce,
    chainId: 11155111,
  };
  
  // 3. Sign with your trusted signer
  const signer = new ethers.Wallet(PRIVATE_KEY);
  const signature = await signer.signTypedData(DOMAIN, TYPES, value);
  
  res.json({ score, issuedAt, expiry, nonce, signature });
});
```

---

## Security Considerations

### ✅ **What's Protected**

1. **Replay attacks**: Nonce tracking prevents reusing signatures
2. **Cross-chain replay**: Chain ID binding
3. **Expiry**: Scores can't be used indefinitely
4. **Signature forgery**: EIP-712 with trusted signer
5. **Minimum collateral**: Hard floor ensures baseline security

### ⚠️ **Trust Assumptions**

1. **Ethos Signer**: Contract trusts signatures from `ethosSigner` address
   - **Mitigation**: Use multisig or secure key management
   - **Best practice**: Rotate keys periodically
   
2. **Score Freshness**: Scores can become stale before expiry
   - **Mitigation**: Set reasonable expiry (7 days recommended)
   - **Frontend**: Refresh scores before critical transactions

3. **Default Risk**: Lower collateral = higher buyer risk
   - **Mitigation**: Hard floor (50%), penalty system
   - **Future**: Optional buyer insurance fund

### 🔒 **Circuit Breakers**

1. **Global disable**: `setEthosGloballyEnabled(false)`
2. **Per-project disable**: `setProjectEthosEnabled(projectId, false)`
3. **Signer removal**: `setEthosSigner(address(0))`

---

## Gas Optimization Notes

- **EIP-712 verification**: ~5-7k gas (one-time per order)
- **Nonce storage**: ~20k gas (first use), ~5k gas (subsequent)
- **Tier lookup**: O(log n) iteration, negligible

**Total overhead**: ~25-30k gas for first Ethos order, ~12-15k for subsequent

---

## Testing Checklist

### Unit Tests
- [ ] Score verification with valid signature
- [ ] Reject expired scores
- [ ] Reject replayed nonces
- [ ] Reject wrong chain ID
- [ ] Reject invalid signer
- [ ] Collateral calculation for each tier
- [ ] Floor enforcement
- [ ] Opt-out mechanism (useEthos=false)
- [ ] Per-project toggle
- [ ] Global circuit breaker

### Integration Tests
- [ ] Full order flow with Ethos discount
- [ ] Settlement with partial collateral
- [ ] Default handling with reduced collateral
- [ ] Cancellation with partial collateral
- [ ] Multiple orders same wallet
- [ ] Tier updates mid-lifecycle

### Fuzzing
- [ ] Random scores (0-3000+)
- [ ] Random collateral percentages
- [ ] Random expiry timestamps
- [ ] Malformed signatures

---

## Deployment Checklist

### Pre-Deployment
- [ ] Audit smart contract (focus on signature verification)
- [ ] Set up Ethos API integration or attester service
- [ ] Generate and secure signer private key (multisig recommended)
- [ ] Test on testnet with real Ethos scores
- [ ] Frontend integration and UX testing
- [ ] Documentation for users

### Deployment
- [ ] Deploy contract
- [ ] Set `ethosSigner` address
- [ ] Configure tiers via `setEthosTiers()`
- [ ] Enable for pilot projects: `setProjectEthosEnabled()`
- [ ] Keep global enabled: `setEthosGloballyEnabled(true)`

### Post-Deployment
- [ ] Monitor first transactions
- [ ] Track default rates by tier
- [ ] Adjust tiers based on data
- [ ] Gather user feedback

---

## Future Enhancements

1. **Dynamic Tiers**: Adjust based on market conditions and default rates
2. **Insurance Pool**: Optional buyer insurance for high-risk orders
3. **Multi-Signature Tiers**: Require multiple reputation sources
4. **Time-Weighted Scores**: Recent activity matters more
5. **On-Chain Reputation**: Build internal reputation based on order history
6. **Gradual Rollout**: Start with higher floors, lower over time

---

## Example Usage

### Scenario 1: Renowned Seller (Top Tier)
- **Ethos Score**: 2650 (Renowned)
- **Order**: Sell 1000 tokens @ $1 = $1000 value
- **Without Ethos**: $1000 collateral (100%)
- **With Ethos**: $500 collateral (50%)
- **Savings**: $500 unlocked for other uses

### Scenario 2: Exemplary Seller
- **Ethos Score**: 2100 (Exemplary)
- **Order**: Sell 500 tokens @ $2 = $1000 value
- **Without Ethos**: $1000 collateral (100%)
- **With Ethos**: $800 collateral (80%)
- **Savings**: $200

### Scenario 3: Reputable Seller
- **Ethos Score**: 1850 (Reputable)
- **Order**: Sell 2000 tokens @ $0.50 = $1000 value
- **Without Ethos**: $1000 collateral (100%)
- **With Ethos**: $900 collateral (90%)
- **Savings**: $100

### Scenario 4: Established Seller (No Discount)
- **Ethos Score**: 1700 (Established)
- **Order**: Sell 2000 tokens @ $0.50 = $1000 value
- **Collateral**: $1000 (100%)
- **No discount applied** (below 1800 threshold)

---

## FAQ

**Q: Can buyers use Ethos discounts?**  
A: No, only sellers. Buyers always post 100% payment.

**Q: What happens if seller defaults with 50% collateral?**  
A: Buyer receives the 50% collateral + settlement fees. Remaining 50% loss is buyer's risk (hence the reputation requirement).

**Q: Can I increase collateral above 100%?**  
A: No, 100% is the maximum. Ethos only reduces, never increases.

**Q: What if Ethos goes offline?**  
A: Orders continue with 100% collateral (default behavior). No disruption.

**Q: How often can I update my score?**  
A: Each order creation fetches a fresh score with new nonce. Cache scores to reduce API calls.

**Q: Can I force 100% even with high score?**  
A: Yes, set `useEthos = false` when creating order.

---

## Contact & Feedback

This is an experimental feature. Feedback welcome on:
- Security concerns
- UX improvements
- Tier adjustments
- Integration challenges

**Status**: 🧪 Not deployed, pending review and testing.

