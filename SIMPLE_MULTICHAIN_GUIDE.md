# 🌐 Simple Multichain Guide - Using RainbowKit's Built-in Chain Switcher

**You're right!** RainbowKit already has a beautiful built-in chain switcher. No need for a custom one!

---

## ✅ What We're Using

RainbowKit's native chain switcher (the one you showed in the screenshot) - it's already perfect:
- Beautiful modal UI
- Network icons
- "Connected" status
- Automatic wallet switching

---

## 🚀 How to Add New Chains (Super Simple!)

### **Step 1: Deploy your contracts to the new chain**

```bash
forge script script/DeployV4.s.sol --rpc-url arbitrum --broadcast
```

### **Step 2: Update `wagmi.ts` (ONE file!)**

Just uncomment the chains you want:

```typescript
// frontend/src/lib/wagmi.ts

chains: [
  sepolia,
  arbitrum,    // ← Just uncomment this!
  base,        // ← And this!
  // optimism,
  // polygon,
],

transports: {
  [sepolia.id]: http(sepoliaRpc),
  [arbitrum.id]: http(arbitrumRpc),  // ← And this!
  [base.id]: http(baseRpc),          // ← And this!
  // [optimism.id]: http(optimismRpc),
  // [polygon.id]: http(polygonRpc),
},
```

### **Step 3: Update `chains.ts` with deployed addresses**

```typescript
// frontend/src/lib/chains.ts

arbitrum: {
  id: 42161,
  orderbook: '0xYOUR_DEPLOYED_ADDRESS', // ← Add your deployed address
  registry: '0xYOUR_REGISTRY_ADDRESS',  // ← Add your registry address
  enabled: true,                         // ← Change to true
},
```

### **Step 4: Done! 🎉**

RainbowKit automatically shows the new chains in its built-in switcher modal.

---

## 📱 User Experience

### **What Users See:**

1. Click "Switch Networks" button in navbar
2. Beautiful RainbowKit modal pops up (like your screenshot)
3. See all available chains:
   - 🧪 **Sepolia** - Connected ✓
   - 🔵 **Arbitrum**
   - 🔵 **Base**
   - 🔴 **Optimism**
4. Click on any chain
5. Wallet prompts to switch
6. Done! App automatically uses new chain's contracts

---

## 🔧 How Chain-Specific Contracts Work

### **Option 1: Use chains.ts config (Recommended)**

```typescript
import { useChainId } from 'wagmi';
import { getContractAddresses } from '@/lib/contracts';

function MyComponent() {
  const chainId = useChainId();
  const { ORDERBOOK_ADDRESS, STABLE_ADDRESS } = getContractAddresses(chainId);
  
  // Use addresses for current chain
}
```

### **Option 2: Use env vars (Current - works fine)**

Your current setup with `.env.local` works great for single chain:

```env
NEXT_PUBLIC_ORDERBOOK=0x95a7cB49A83cd4b889bF9Be36E24e65b92B51eb7
NEXT_PUBLIC_REGISTRY=0x76E06a3b4e1E42eB9D1f6dC6BcA46E4C227AA7CA
NEXT_PUBLIC_STABLE=0xd5d56a9Cd59550c6D95569620F7eb89C1E4c9101
```

For multichain, you can:
- Keep using env vars and just change them when deploying
- OR switch to using `chains.ts` for dynamic addresses

---

## 🎯 Super Simple Example

### **Before (Sepolia only):**

```typescript
// wagmi.ts
chains: [sepolia]
```

RainbowKit shows: "Sepolia"

### **After (Add Arbitrum):**

```typescript
// wagmi.ts
chains: [sepolia, arbitrum]
```

RainbowKit automatically shows both:
- Sepolia
- Arbitrum

**That's it!** RainbowKit handles everything else:
- Chain switching UI
- Network icons
- Connection status
- Error handling
- Mobile responsive

---

## 📋 Quick Checklist for Adding a Chain

1. [ ] Deploy contracts to new chain
2. [ ] Uncomment chain in `wagmi.ts` (line 24)
3. [ ] Uncomment transport in `wagmi.ts` (line 34)
4. [ ] Update deployed addresses in `chains.ts` (optional, for dynamic addresses)
5. [ ] Test switching in the app
6. [ ] Done! ✅

---

## 🎨 RainbowKit Does All This For You:

✅ Beautiful chain switcher modal  
✅ Network icons and colors  
✅ "Connected" status indicator  
✅ Wrong network warnings  
✅ Mobile responsive design  
✅ Accessibility support  
✅ Error handling  
✅ Loading states  
✅ Dark mode  

**No custom component needed!**

---

## 💡 Why RainbowKit's Built-in is Better:

1. ✅ **Professional UI** - Battle-tested design
2. ✅ **Always up-to-date** - Maintained by RainbowKit team
3. ✅ **Familiar** - Users know this UI from other dapps
4. ✅ **Less code** - No custom component to maintain
5. ✅ **Zero bugs** - Already tested by thousands of dapps
6. ✅ **Better UX** - Consistent with Connect Wallet modal

---

## 📝 Summary

### **What Changed:**
- ❌ Removed custom ChainSwitcher component (not needed!)
- ✅ Using RainbowKit's built-in chain switcher
- ✅ Just configure chains in `wagmi.ts`

### **How to Add Chains:**
```typescript
// 1. Deploy contracts
// 2. Edit wagmi.ts - uncomment 2 lines
// 3. Done!
```

### **Files to Edit:**
- `frontend/src/lib/wagmi.ts` ← Only this one!
- `frontend/src/lib/chains.ts` ← Optional, for dynamic addresses

**Simple, clean, and uses the tool that's already built-in!** 🎉

---

## 🚀 Ready to Go Multichain?

When you deploy to Arbitrum/Base:

1. Deploy contracts
2. Open `frontend/src/lib/wagmi.ts`
3. Uncomment lines 24 & 34
4. Restart app
5. ✨ Chain switcher automatically works!

**That's it!** No custom components, no complex logic, just RainbowKit's magic. 🪄

