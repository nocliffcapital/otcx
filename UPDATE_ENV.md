# Update Environment Variables

## ⚠️ ACTION REQUIRED

You need to update your frontend `.env.local` file with the new contract address.

## Steps:

### 1. Open the file:
```bash
cd /Users/nationalbank/Library/Containers/com.hp.PSDrMonitor/Data/tmp/otcx/frontend
nano .env.local
# or use your preferred editor
```

### 2. Find and replace this line:
```env
NEXT_PUBLIC_ORDERBOOK=0xD7012e8fde0d0c27b72EFE3CC0D315349d433000
```

### 3. With this new address:
```env
NEXT_PUBLIC_ORDERBOOK=0x95a7cB49A83cd4b889bF9Be36E24e65b92B51eb7
```

### 4. Save the file

### 5. Restart your frontend server
Press `Ctrl+C` to stop the server, then run:
```bash
npm run dev
```

---

## Why This Change?

The old contract didn't have the `conversionRatio` parameter in `activateProjectTGE`. We deployed a new V4 contract with full conversion ratio support for Points-to-Tokens settlement.

## New Contract Features:
- ✅ Points-to-Tokens conversion ratio
- ✅ 1-hour grace period for ratio updates
- ✅ Token supply validation
- ✅ All security audit fixes

## Contract Details:
- **Old Contract**: `0xD7012e8fde0d0c27b72EFE3CC0D315349d433000`
- **New Contract**: `0x95a7cB49A83cd4b889bF9Be36E24e65b92B51eb7`
- **Verified**: Yes (Sourcify)
- **Network**: Sepolia Testnet

---

**After updating, you'll be able to activate TGE for token projects like MegaETH! 🚀**

