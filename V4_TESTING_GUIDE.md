# V4 Testing Guide

**Network**: Sepolia Testnet  
**Status**: ✅ Fully Integrated & Ready for Testing

---

## 🎯 What Changed in V4?

### Smart Contract Updates
1. **Project-Level TGE Activation**
   - Instead of activating each order individually, TGE is now activated once per project
   - More gas efficient (no loops)
   - Permissionless settlement after activation
   - Custom settlement windows per project

2. **Collateral Whitelist**
   - Only approved tokens can be used as collateral
   - Initially: USDC ✅ USDT ✅
   - Admin can add/remove approved tokens
   - Prevents malicious/fake token usage

3. **Configurable Fees**
   - Settlement fee: 0.5% (default, configurable 0-5%)
   - Cancellation fee: 0.1% (default, configurable 0-5%)
   - Owner can adjust via admin panel
   - Fees collected to protocol wallet

4. **Security Enhancements**
   - CEI pattern enforced (Checks-Effects-Interactions)
   - SafeTransferLib for robust ERC20 handling
   - 18-decimal enforcement for project tokens
   - Decimals-aware MAX_ORDER_VALUE

### Frontend Updates
1. **contracts.ts**
   - Now imports `EscrowOrderBookV4ABI`
   - V4 configuration and comments updated

2. **TGESettlementManager.tsx**
   - Uses `activateProjectTGE(projectId, tokenAddress, settlementWindow)`
   - Batch activation applies to entire project (not per-order)
   - Individual order activation removed

3. **TGEOrderControls.tsx**
   - Individual TGE activation disabled (V4 requires project-level)
   - User redirected to admin panel for TGE activation

---

## 🚀 Testing Checklist

### Pre-Flight Checks ✅
Run the integration report to verify everything is configured:
```bash
./v4-integration-report.sh
```

Expected output:
- ✅ contracts.ts imports V4 ABI
- ✅ .env.local exists with Sepolia addresses
- ✅ V4 ABI exists with activateProjectTGE
- ✅ TGESettlementManager uses V4 functions
- ✅ No deprecated function calls

---

## 🧪 Test Scenarios

### 1. **Environment Setup**

**Start Frontend:**
```bash
cd frontend
npm run dev
```

**Connect Wallet:**
- Network: Sepolia
- Import account: `0x61fEDd6BC4ef1ab11cf8b6CC8F9b4Faeb41B6f55`
- Private key: (you have it)

**Expected Balances:**
- ETH: ~0.022
- USDC: 1,000,000
- USDT: 1,000,000

---

### 2. **View Projects (Markets Page)**

**URL:** `http://localhost:3000/markets`

**Test:**
- [ ] "Lighter" project appears
- [ ] Project card shows metadata (name, logo, description)
- [ ] Stats display correctly (if orders exist)
- [ ] Reputation badge shows for project

**Expected:**
- 1 project listed (Lighter - Points)
- Metadata loads from IPFS (dweb.link gateway)
- No console errors

---

### 3. **Create Orders (Orderbook)**

**URL:** `http://localhost:3000/markets/lighter`

#### Test 3A: Create Sell Order with USDC
- [ ] Click "Create Order"
- [ ] Select "Sell"
- [ ] Enter: 1000 tokens @ 0.1 USDC
- [ ] Collateral: Should auto-detect USDC
- [ ] Transaction: Approve + Create
- [ ] Order appears in orderbook immediately

**Expected:**
- No balance errors (1M USDC available)
- Order created with collateral locked
- Status: OPEN (0)

#### Test 3B: Create Buy Order with USDC
- [ ] Select "Buy"
- [ ] Enter: 500 tokens @ 0.15 USDC
- [ ] Transaction succeeds
- [ ] Order appears in orderbook

**Expected:**
- Funds locked: 500 × 0.15 = 75 USDC
- Status: OPEN (0)

#### Test 3C: Try Creating Order with Insufficient Funds
- [ ] Try to create order for 2,000,000 USDC
- [ ] Transaction should fail with "Insufficient balance" error

**Expected:**
- Balance check prevents transaction
- User-friendly error message

---

### 4. **Take Orders (Match Orders)**

**Setup:** Use a second wallet or your main wallet to take an order

**Test:**
- [ ] Connect wallet with funds
- [ ] Click "Take Order" on an existing order
- [ ] Approve USDC spending
- [ ] Take order transaction
- [ ] Order moves to "Funded" status
- [ ] Collateral locked for both parties

**Expected:**
- Status changes: OPEN (0) → FUNDED (1)
- Both buyer and seller collateral locked
- Order removed from orderbook (pending TGE)

---

### 5. **Cancel Orders**

#### Test 5A: Cancel OPEN Order
- [ ] Create an order
- [ ] Immediately cancel it
- [ ] Cancellation fee applied (0.1%)
- [ ] Refund received minus fee

**Expected:**
- Fee: ~0.1% of order value
- Status: CANCELED (5)
- Refund in wallet

#### Test 5B: Cancel FUNDED Order
- [ ] Create and fund an order (with another wallet)
- [ ] Maker cancels
- [ ] Counterparty gets full refund
- [ ] Maker pays cancellation fee

**Expected:**
- Counterparty: 100% refund
- Maker: Refund minus 0.1% fee
- Status: CANCELED (5)

---

### 6. **Admin Panel (Owner Only)**

**URL:** `http://localhost:3000/admin`

**Test 6A: View Projects**
- [ ] "Lighter" project appears
- [ ] Shows: Name, Type (Points), Status (Active)
- [ ] Metadata URI displayed
- [ ] Token address field (0x000...dead for Points)

**Test 6B: View Approved Collateral**
- [ ] Collateral list shows USDC ✅
- [ ] Collateral list shows USDT ✅
- [ ] Each shows address + decimals

**Test 6C: View Fee Configuration**
- [ ] Settlement fee: 50 (0.5%)
- [ ] Cancellation fee: 10 (0.1%)
- [ ] Max fee: 500 (5%)

**Test 6D: Update Fees (Owner Only)**
- [ ] Change settlement fee to 1%
- [ ] Change cancellation fee to 0.2%
- [ ] Transaction succeeds
- [ ] New fees applied to future orders

**Expected:**
- Only owner wallet can update fees
- Fee range: 0-5% (0-500 BPS)
- Updates reflected immediately

---

### 7. **TGE Activation (Critical V4 Feature)**

**URL:** `http://localhost:3000/admin` → TGE Settlement Manager

**Prerequisites:**
- At least one FUNDED order exists
- Owner wallet connected

#### Test 7A: Activate TGE for Points Project
- [ ] Navigate to TGE Settlement Manager
- [ ] See list of funded orders
- [ ] Enter token address: `0x000000000000000000000000000000000000dead`
- [ ] Click "Activate Project TGE"
- [ ] Confirm transaction
- [ ] Settlement window: 4 hours (14400 seconds)

**Expected:**
- Function called: `activateProjectTGE(projectId, 0x000...dead, 14400)`
- All orders in project become settleable
- No per-order loop (gas efficient!)

#### Test 7B: Activate TGE for Token Project
*Note: Requires adding a token project first*

- [ ] Add token project via admin panel
- [ ] Create + fund orders
- [ ] Deploy actual ERC20 token (18 decimals)
- [ ] Activate TGE with real token address
- [ ] Verify 18-decimal check passes

**Expected:**
- V4 enforces 18-decimal tokens
- Token validation checks for contract code
- Settlement window customizable

---

### 8. **Settlement (After TGE)**

**Prerequisites:**
- TGE activated
- Within settlement window (4 hours default)

#### Test 8A: Permissionless Settlement
- [ ] Anyone can call `settleOrder(orderId)`
- [ ] Buyer receives tokens (or proof verified)
- [ ] Seller receives payment
- [ ] Fees deducted (0.5% from each side)
- [ ] Status: SETTLED (3)

**Expected:**
- Settlement fee: 0.5% stable + 0.5% tokens
- Fee collector receives fees
- Both parties get remaining collateral

#### Test 8B: Settlement Outside Window
- [ ] Wait for settlement window to expire
- [ ] Try to settle
- [ ] Should revert or default

**Expected:**
- Time-bound settlement enforcement
- Defaulted orders handled correctly

---

### 9. **Dashboard (User View)**

**URL:** `http://localhost:3000/dashboard`

**Test:**
- [ ] View your active orders
- [ ] View your order history
- [ ] Timeline shows correct statuses
- [ ] Collateral amounts displayed
- [ ] Actions available based on status

**Expected:**
- OPEN: Cancel button
- FUNDED: Wait for TGE
- TGE_ACTIVATED: Settle button
- SETTLED: View details
- Status timeline accurate

---

### 10. **Collateral Whitelist Management**

**URL:** `http://localhost:3000/admin`

#### Test 10A: View Approved Collateral
- [ ] List shows USDC and USDT
- [ ] Each token shows address + decimals

#### Test 10B: Add New Collateral (Owner Only)
- [ ] Deploy a new MockERC20
- [ ] Call `approveCollateral(tokenAddress, decimals)`
- [ ] Token appears in approved list
- [ ] Users can now create orders with this token

**Expected:**
- Only owner can approve collateral
- Decimals validation (0-18)
- Frontend updates to show new token

#### Test 10C: Remove Collateral
- [ ] Call `removeCollateral(tokenAddress)`
- [ ] Token removed from list
- [ ] Existing orders unaffected
- [ ] New orders can't use this token

**Expected:**
- Cannot remove stable token (USDC in our case)
- Removal prevents future orders only

---

## 🐛 Common Issues & Solutions

### Issue 1: "Network mismatch"
**Solution:** Ensure MetaMask is on Sepolia (Chain ID 11155111)

### Issue 2: "Insufficient balance"
**Solution:** Check you have USDC/USDT and ETH for gas

### Issue 3: "Contract not found"
**Solution:** Verify `.env.local` has correct contract addresses

### Issue 4: "activateProjectTGE not found"
**Solution:** Re-run `./v4-integration-report.sh` to verify V4 ABI is loaded

### Issue 5: Orders not appearing
**Solution:** 
- Check order has collateral (status filtering)
- Verify you're viewing correct project
- Check wallet is connected

### Issue 6: TGE activation fails
**Solution:**
- Ensure at least one FUNDED order exists
- Owner wallet must be connected
- Token address must be valid (18 decimals or 0x000...dead for Points)

---

## 📊 Test Results Template

Copy this template and fill in your test results:

```markdown
## V4 Test Results

**Date:** [Date]
**Tester:** [Your name]
**Network:** Sepolia
**Contract:** 0x2BaC859185318723CacE7688674DD5ad873abDcf

### Integration Checks
- [ ] V4 ABI imported ✅ / ❌
- [ ] Environment variables correct ✅ / ❌
- [ ] No deprecated functions ✅ / ❌

### Functionality Tests
- [ ] View projects ✅ / ❌
- [ ] Create sell order ✅ / ❌
- [ ] Create buy order ✅ / ❌
- [ ] Take order ✅ / ❌
- [ ] Cancel order (OPEN) ✅ / ❌
- [ ] Cancel order (FUNDED) ✅ / ❌
- [ ] View admin panel ✅ / ❌
- [ ] Update fees ✅ / ❌
- [ ] Activate project TGE ✅ / ❌
- [ ] Settle order ✅ / ❌
- [ ] View collateral whitelist ✅ / ❌

### Bugs Found
1. [Description]
2. [Description]

### Notes
[Any observations or comments]
```

---

## 🔗 Quick Links

- **Frontend:** http://localhost:3000
- **Orderbook Contract:** https://sepolia.etherscan.io/address/0x2BaC859185318723CacE7688674DD5ad873abDcf
- **Registry Contract:** https://sepolia.etherscan.io/address/0x2154dB207DEf79E915cA795B99Fe4AAf96d89845
- **MockUSDC:** https://sepolia.etherscan.io/address/0x6B4096e6b04f20619145527880266b408b7b204D
- **MockUSDT:** https://sepolia.etherscan.io/address/0x950D0d95701D7F7E63dDB5E8B7080bB3a4b942ce
- **Sepolia Faucet:** https://sepoliafaucet.com/

---

## 📝 Post-Testing

After testing, please:
1. Document any bugs in GitHub issues
2. Share test results with the team
3. Suggest UI/UX improvements
4. Verify gas costs are reasonable
5. Check event logs on Etherscan

---

**Good luck testing! 🚀**

For questions or issues, check:
- `V4_SECURITY_AUDIT.md` - Security details
- `V4_AUDIT_RESPONSE.md` - Implementation notes
- `V4_SEPOLIA_DEPLOYMENT.md` - Deployment info



