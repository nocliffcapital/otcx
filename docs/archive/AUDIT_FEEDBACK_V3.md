# Audit Feedback - Design Improvements for V3

## Summary
The auditor identified two major structural improvements for a cleaner, more gas-efficient design.

---

## 1. Use `bytes32` for Project Identifiers (Not `address`)

### Problem
Currently, orders use `address projectToken` as the project identifier:
```solidity
struct Order {
    address projectToken;  // Using address as identifier - WRONG
}

function createSellOrder(uint256 amount, uint256 unitPrice, address projectToken)
```

**Issues:**
- Projects don't have token addresses before TGE
- We're using fake placeholder addresses (e.g., `0x68616...` for "hackFrontrunner")
- Conflates two concepts: project identifier vs actual token address
- Hard to migrate if token address changes

### Solution
Use `bytes32` as project identifier (hash of project name/slug):

```solidity
struct Order {
    bytes32 projectId;     // keccak256("lighter") - consistent identifier
    address actualToken;   // 0x0 until TGE activation
}

function createSellOrder(uint256 amount, uint256 unitPrice, bytes32 projectId)

// Frontend generates projectId:
const projectId = keccak256(toUtf8Bytes("lighter"));
```

**Benefits:**
- ✅ Works before TGE - no fake addresses needed
- ✅ Clean separation: projectId (identifier) vs actualToken (address)
- ✅ Consistent - everyone hashes the same string
- ✅ Gas efficient - bytes32 is cheaper than address storage

### Migration Impact
This is a **MAJOR refactor** affecting:
- `EscrowOrderBookV2.sol` → `EscrowOrderBookV3.sol`
  - Order struct
  - All order creation functions
  - `projectTgeActivated` mapping (now `bytes32 => bool`)
  - All events
- `ProjectRegistry.sol` → `ProjectRegistryV2.sol`
  - Use `bytes32 id` instead of `string slug` as primary key
- Frontend
  - All contract calls
  - ABI updates
  - Project page routing

---

## 2. Remove Heavy Metadata from On-Chain Storage

### Problem
Current `ProjectRegistry` stores expensive strings on-chain:
```solidity
struct Project {
    string slug;           // ~20-50 bytes
    string name;           // ~20-50 bytes
    string description;    // 100-500 bytes 💰💰💰
    string twitterUrl;     // ~30-50 bytes
    string websiteUrl;     // ~30-50 bytes
    string logoUrl;        // ~50-100 bytes
    // ... more fields
}
```

**Issues:**
- 💰 **Expensive:** Adding a project costs ~500k-1M gas
- 🗄️ **Wasteful:** This data doesn't need blockchain consensus
- 🔒 **Inflexible:** Can't update descriptions without expensive transactions
- 📈 **Scales poorly:** More projects = higher gas costs

### Solution
Store only essential data on-chain, link to off-chain metadata:

```solidity
struct Project {
    bytes32 id;            // keccak256(slug) - 32 bytes
    string name;           // Short name (max 50 chars)
    address tokenAddress;  // 20 bytes
    bool isPoints;         // 1 byte
    bool active;           // 1 byte
    uint64 addedAt;        // 8 bytes
    string metadataURI;    // IPFS/Arweave link (~50 bytes)
}
```

**Off-chain metadata** (stored on IPFS/Arweave):
```json
{
  "slug": "lighter",
  "description": "Full project description here...",
  "twitterUrl": "https://x.com/lighter",
  "websiteUrl": "https://lighter.xyz",
  "logoUrl": "https://...",
  "tags": ["DeFi", "DEX"],
  "team": [...],
  "socials": {...}
}
```

**Benefits:**
- ✅ **90% gas reduction** on project creation (~50k gas vs 500k)
- ✅ **Flexible metadata** - update descriptions without transactions
- ✅ **Richer data** - no limits on description length, can add images, videos, etc.
- ✅ **Future-proof** - can add new metadata fields without contract upgrades

### Frontend Changes
```typescript
// Fetch project from chain
const project = await registry.getProject(projectId);

// Fetch metadata from IPFS
const metadata = await fetch(project.metadataURI).then(r => r.json());

// Render
<h1>{project.name}</h1>
<p>{metadata.description}</p>
<img src={metadata.logoUrl} />
```

---

## Implementation Plan

### Phase 1: Create V3 Contracts (Recommended)
1. Create `ProjectRegistryV2.sol` ✅ (completed)
2. Create `EscrowOrderBookV3.sol` with `bytes32 projectId`
3. Write deployment script
4. Test thoroughly on testnet

### Phase 2: Frontend Updates
1. Update contract ABIs
2. Add `keccak256` helper for projectId generation
3. Add IPFS metadata fetching
4. Update all contract interaction calls

### Phase 3: Migration Strategy
**Option A: Fresh Start (Recommended for MVP)**
- Deploy V3 contracts
- Keep V2 running for existing orders to settle
- Point frontend to V3 for new orders

**Option B: Gradual Migration**
- Deploy V3 alongside V2
- Let users choose which version to use
- Eventually deprecate V2

---

## Cost Comparison

### Current V2 (On-chain metadata)
- Add project: ~800k gas (~$20 @ 25 gwei, $2000 ETH)
- Update project: ~200k gas (~$5)
- Total for 100 projects: ~80M gas (~$2000)

### Proposed V3 (Off-chain metadata)
- Add project: ~80k gas (~$2)
- Update metadata: FREE (just IPFS upload)
- Total for 100 projects: ~8M gas (~$200)

**Savings: 90% reduction in gas costs** 💰

---

## Files Created
- `contracts/src/ProjectRegistryV2.sol` - Minimal registry with metadata URIs ✅
- `contracts/src/EscrowOrderBookV3.sol` - Orderbook with bytes32 projectId ✅
- `AUDIT_FEEDBACK_V3.md` - This document ✅

## Key V3 Improvements
1. **Uses Solady** for Ownable/ReentrancyGuard (gas optimized, battle-tested)
2. **bytes32 projectId** instead of fake address placeholders
3. **Off-chain metadata** via IPFS/Arweave URIs
4. **Combined transactions** (take + deposit in one tx)
5. **Auto-settlement** (no manual claim step)

## Next Steps
1. Review this design with the auditor ✅
2. Set up IPFS/Arweave for metadata hosting
3. Write comprehensive tests for V3
4. Deploy to testnet and verify
5. Update frontend to support V3 ABIs and bytes32 projectIds

