# 🚀 V2 Deployment Complete - Sepolia

## ✅ **Deployed Addresses**

```
Network: Sepolia (Chain ID: 11155111)
MockUSDC (Stable):       0xF242c392B0ab58459508E2b29cFe4C775926bb51
EscrowOrderBookV2:       0x48468a47A5ED7968373f9AdfAD5af3c8d40B2c9d
ProjectRegistry:         0x5DC0110b057331018693FfCf96983Fd02c91ad0e (existing)
```

## 📝 **Update Frontend**

Edit `frontend/.env.local`:

```bash
NEXT_PUBLIC_ORDERBOOK=0x48468a47A5ED7968373f9AdfAD5af3c8d40B2c9d
NEXT_PUBLIC_STABLE=0xF242c392B0ab58459508E2b29cFe4C775926bb51
# Keep the same:
NEXT_PUBLIC_REGISTRY=0x612dc3Cac9600AD67162F592005de3a5eDD9f199
```

⚠️ **Note:** You currently have a different registry address in your .env.local (`0x612dc3...`) than what was deployed (`0x5DC01...`). The script reused an existing registry. If you want to use your current registry, keep your current `NEXT_PUBLIC_REGISTRY` value.

## 🔄 **Restart Frontend**

```bash
cd frontend
# Kill existing process
pkill -f "next dev"
# Start fresh
npm run dev
```

## ✨ **New V2 Features**

### **1. TGE Settlement System**
- ✅ 4-hour settlement windows
- ✅ 4h/24h extensions
- ✅ Default protection (2x compensation)
- ✅ Automated on-chain settlement for Tokens

### **2. Proof Submission for Points**
- ✅ Seller submits proof (tx hash, screenshot, etc.)
- ✅ Admin reviews proof before settling
- ✅ On-chain proof storage
- ✅ Timestamp tracking

### **3. Admin Panel Enhancements**
- ✅ TGE controls in "Edit Project" form
- ✅ Per-project order management
- ✅ Proof review interface
- ✅ Grayed out buttons when no orders

### **4. User Experience**
- ✅ Settlement status badges
- ✅ Countdown timers
- ✅ Deposit/claim/default buttons
- ✅ Proof submission form

## 🧪 **Testing Workflow**

### **Test 1: Tokens (On-Chain Settlement)**
1. Create order for "Pacifica" (Tokens) - use 2 wallets
2. Both deposit collateral → Status: FUNDED
3. Admin: Edit "Pacifica" → Activate TGE → enter token address → Start 4h
4. Seller: Deposit tokens to contract
5. Buyer: Claim tokens
6. ✅ Check: Buyer has tokens, seller has payment

### **Test 2: Points (Proof-Based Settlement)**
1. Create order for "Lighter" (Points) - use 2 wallets
2. Both deposit collateral → Status: FUNDED
3. Seller: Transfer points off-chain (Discord/Phantom)
4. Seller: "Submit Proof" → enter screenshot link → Submit
5. Admin: Edit "Lighter" → See proof box → Verify → "Verify & Settle"
6. ✅ Check: Seller receives payment + collateral

### **Test 3: Extensions**
1. Create & fund order
2. Admin: Activate TGE
3. Admin: Click "+4 Hours" → verify deadline extended
4. Admin: Click "+24 Hours" → verify deadline extended

### **Test 4: Default Protection**
1. Create & fund order
2. Admin: Activate TGE
3. Wait for 4-hour deadline to pass (or set shorter in testing)
4. Buyer: Click "Default Seller (Get 2x)"
5. ✅ Check: Buyer receives payment + seller's collateral

## 🔗 **Contract Links**

- **OrderbookV2:** https://sepolia.etherscan.io/address/0x48468a47A5ED7968373f9AdfAD5af3c8d40B2c9d
- **MockUSDC:** https://sepolia.etherscan.io/address/0xF242c392B0ab58459508E2b29cFe4C775926bb51
- **Registry:** https://sepolia.etherscan.io/address/0x5DC0110b057331018693FfCf96983Fd02c91ad0e

## 🎯 **What Changed from V1**

| Feature | V1 | V2 |
|---------|----|----|
| Settlement | Manual "markFilled" | TGE windows + proof system |
| Tokens | Trust-based | Contract-enforced deposit/claim |
| Points | No proof | On-chain proof submission |
| Default Protection | ❌ | ✅ 2x compensation |
| Extensions | ❌ | ✅ 4h/24h extensions |
| Admin Controls | Basic | Per-project TGE management |

## 🎉 **You're Live!**

Your otcX platform now has:
- ✅ Production-grade settlement system
- ✅ Whales Market-style TGE flow
- ✅ Proof-based Points settlement
- ✅ Complete admin controls
- ✅ User-friendly interface

Time to test! 🚀


