# V4 Localhost Setup Guide

**Date**: October 22, 2025  
**Status**: ✅ Deployed and Ready for Testing  
**Network**: Localhost (Anvil) - Port 8545

---

## 🚀 Deployed Contracts

### Core Contracts

| Contract | Address | Description |
|----------|---------|-------------|
| **MockUSDC** | `0x5FbDB2315678afecb367f032d93F642f64180aa3` | 6-decimal stablecoin (primary) |
| **MockUSDT** | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` | 6-decimal stablecoin (approved) |
| **ProjectRegistryV2** | `0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9` | Project metadata registry |
| **EscrowOrderBookV4** | `0x5FC8d32690cc91D4c39d9d3abcBD16989F875707` | Order book with fees & whitelist |

### Test Account

- **Address**: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- **Private Key**: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
- **USDC Balance**: 1,000,000 USDC
- **USDT Balance**: 1,000,000 USDT

---

## 📁 Frontend Configuration

Your `frontend/.env.local` is updated with:

```bash
NEXT_PUBLIC_REGISTRY=0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
NEXT_PUBLIC_ORDERBOOK=0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
NEXT_PUBLIC_STABLE=0x5FbDB2315678afecb367f032d93F642f64180aa3
NEXT_PUBLIC_STABLE_DECIMALS=6
NEXT_PUBLIC_USDT=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
NEXT_PUBLIC_RPC=http://localhost:8545
```

---

## ✅ What's Ready

### V4 Features Deployed
- ✅ Collateral whitelist (USDC auto-approved, USDT manually approved)
- ✅ SafeTransferLib for robust ERC20 handling
- ✅ 18-decimal token enforcement
- ✅ Decimals-aware MAX_ORDER_VALUE
- ✅ Per-project settlement windows
- ✅ Configurable fees (0.5% settlement, 0.1% cancellation)
- ✅ View helpers for UI integration
- ✅ CEI pattern enforced
- ✅ Project-level TGE activation

### Pre-Seeded Data
- ✅ **Lighter** project added (Points project)
- ✅ IPFS metadata: `ipfs://QmRYhCw2gWkKQi8qwWuDyzE6rDp7GMe1iYWEDhEQFPH2Nx`

---

## 🧪 Testing Checklist

### Anvil Status
```bash
# Check if Anvil is running
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### Frontend Connection
```bash
# Start frontend (in /frontend directory)
cd frontend
npm run dev

# Should connect to localhost:8545 automatically
```

### Connect Wallet
1. Open MetaMask
2. Add network:
   - Network Name: `Localhost 8545`
   - RPC URL: `http://localhost:8545`
   - Chain ID: `31337`
   - Currency: `ETH`
3. Import test account using private key above
4. You should see 10,000 ETH + 1M USDC + 1M USDT

---

## 🔧 Admin Functions Available

### Collateral Management
```solidity
// View approved collateral
orderbook.getApprovedCollateral()
// Returns: [USDC, USDT]

// Check if token is approved
orderbook.approvedCollateral(USDC)  // true
orderbook.approvedCollateral(USDT)  // true

// Approve new collateral (owner only)
orderbook.approveCollateral(newToken)

// Remove collateral (owner only, can't remove USDC)
orderbook.removeCollateral(USDT)
```

### Fee Management
```solidity
// Update settlement fee (0-500 bps = 0-5%)
orderbook.setSettlementFee(100)  // 1%

// Update cancellation fee
orderbook.setCancellationFee(20)  // 0.2%
```

### TGE Activation
```solidity
// Activate TGE for Lighter with 4-hour window
bytes32 projectId = keccak256("lighter");
address tokenAddress = POINTS_SENTINEL;  // or actual token
uint64 window = 4 hours;
orderbook.activateProjectTGE(projectId, tokenAddress, window);
```

---

## 📊 Testing Scenarios

### 1. Create Order (USDC Collateral)
```typescript
// Frontend or contract call
const projectId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("lighter"));
const amount = ethers.utils.parseEther("1000");  // 1000 tokens
const unitPrice = 150000;  // $0.15 (6 decimals)
const isSell = true;

await orderbook.createOrder(projectId, amount, unitPrice, isSell);
```

### 2. Check Whitelist
```typescript
const approved = await orderbook.approvedCollateral(USDC_ADDRESS);
console.log("USDC approved:", approved);  // true

const list = await orderbook.getApprovedCollateral();
console.log("All approved:", list);  // [USDC, USDT]
```

### 3. View Helpers
```typescript
// Quote order value
const totalValue = await orderbook.quoteTotalValue(amount, unitPrice);

// Quote seller collateral (110%)
const collateral = await orderbook.quoteSellerCollateral(totalValue);

// Get existing order value
const orderValue = await orderbook.getOrderValue(orderId);
```

### 4. Test Fee Changes
```typescript
// Before: 0.5% (50 bps)
await orderbook.setSettlementFee(100);  // Change to 1%
// Emits: SettlementFeeUpdated(50, 100)

// New orders use 1% fees
```

---

## 🛠️ Troubleshooting

### Anvil Not Running
```bash
# Stop any existing instance
pkill -f anvil

# Start fresh
cd contracts
anvil --port 8545

# Keep this terminal open
```

### Frontend Not Connecting
```bash
# Check .env.local
cat frontend/.env.local

# Restart Next.js
cd frontend
npm run dev
```

### Transaction Failing
```bash
# Check gas and balance
cast balance 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --rpc-url http://localhost:8545

# Check contract deployment
cast code 0x5FC8d32690cc91D4c39d9d3abcBD16989F875707 --rpc-url http://localhost:8545
```

### Reset Everything
```bash
# Kill anvil
pkill -f anvil

# Restart anvil (this resets all state)
cd contracts
anvil --port 8545

# Redeploy
export PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
forge script script/DeployV4.s.sol:DeployV4 --rpc-url http://localhost:8545 --broadcast
```

---

## 📝 Next Steps

### Frontend Updates Needed

1. **Import V4 ABI**
   ```typescript
   // In frontend/src/lib/contracts.ts
   import ESCROW_ORDERBOOK_ABI from './abis/EscrowOrderBookV4.abi.json';
   ```

2. **Update Hook for New Functions**
   - Add `getApprovedCollateral()` view
   - Add `quoteTotalValue()` helper
   - Update `activateProjectTGE()` to include `settlementWindow` param

3. **Admin Panel Updates**
   - Add collateral whitelist management UI
   - Add fee configuration sliders
   - Add settlement window selector for TGE activation

4. **Order Creation UI**
   - Display collateral whitelist
   - Show quote calculations using view helpers
   - Add fee preview

### Testing Priorities

1. ✅ **Create Order Flow**
   - Test with USDC collateral
   - Verify whitelist validation
   - Check collateral amounts

2. ✅ **Take Order Flow**
   - Match existing order
   - Verify FUNDED status
   - Check collateral locked

3. ✅ **TGE Activation**
   - Activate with custom window
   - Test settlement
   - Verify fee collection

4. ✅ **Fee Management**
   - Update fees
   - Verify events emitted
   - Test with new orders

5. ✅ **Collateral Whitelist**
   - View approved list
   - Try removing/adding
   - Verify protection (can't remove USDC)

---

## 🎯 Success Criteria

- [ ] Frontend connects to localhost:8545
- [ ] Can create orders with USDC
- [ ] Can view approved collateral list
- [ ] Admin can update fees
- [ ] TGE activation accepts custom window
- [ ] View helpers work correctly
- [ ] Orders display in frontend
- [ ] Metamask transactions work
- [ ] Events emitted correctly
- [ ] No console errors

---

**Your V4 is now live on localhost and ready for comprehensive testing!** 🚀

All audit recommendations implemented ✅  
Collateral whitelist ready for USDT ✅  
View helpers for better UX ✅  
Ready for production after testing ✅


