# 🚀 Netlify Deployment Guide - otcx.fun

## ✅ Pre-Deployment Checklist

- [x] **Grok API Removed** - No API keys needed
- [x] **Latest V4 Contracts Deployed** on Sepolia
- [x] **Chain Config** ready for multichain
- [x] **Registry V2** deployed and configured

---

## 🔧 Netlify Environment Variables

Go to: **Netlify Dashboard → Site Settings → Environment Variables**

### **Required Variables:**

```bash
# Contract Addresses (Sepolia Testnet)
NEXT_PUBLIC_ORDERBOOK=0x95a7cB49A83cd4b889bF9Be36E24e65b92B51eb7
NEXT_PUBLIC_REGISTRY=0x76E06a3b4e1E42eB9D1f6dC6BcA46E4C227AA7CA
NEXT_PUBLIC_STABLE=0xd5d56a9Cd59550c6D95569620F7eb89C1E4c9101

# Stable Token Config
NEXT_PUBLIC_STABLE_DECIMALS=6

# WalletConnect Project ID (for RainbowKit)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here

# RPC URLs (Optional - will use public RPCs if not set)
NEXT_PUBLIC_SEPOLIA_RPC=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
```

### **Optional (For Future Multichain):**

```bash
# Mainnet RPCs (Enable when deploying to mainnets)
NEXT_PUBLIC_ARBITRUM_RPC=https://arb1.arbitrum.io/rpc
NEXT_PUBLIC_BASE_RPC=https://mainnet.base.org
NEXT_PUBLIC_OPTIMISM_RPC=https://mainnet.optimism.io
NEXT_PUBLIC_POLYGON_RPC=https://polygon-rpc.com
NEXT_PUBLIC_ETHEREUM_RPC=https://eth.llamarpc.com
```

---

## 📝 Build Settings

### **Current Configuration** (in `netlify.toml`):

```toml
[build]
  command = "cd frontend && npm install && npm run build"
  publish = "frontend/.next"

[build.environment]
  SECRETS_SCAN_ENABLED = "false"
  NODE_VERSION = "22"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

✅ **No changes needed** - this is correct!

---

## 🎯 WalletConnect Setup

### **1. Get Your Project ID:**

1. Go to: https://cloud.walletconnect.com/
2. Sign up / Log in
3. Create a new project: **"otcX Trading Platform"**
4. Copy your **Project ID**
5. Add to Netlify env vars: `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`

### **2. Configure Allowed Domains:**

In WalletConnect dashboard, add these domains:
- `otcx.fun`
- `*.netlify.app` (for preview deploys)
- `localhost:3000` (for local dev)

---

## 🔍 Registry Configuration

### **How the Frontend Uses Registry:**

The frontend connects to the on-chain `ProjectRegistryV2` at:
```
0x76E06a3b4e1E42eB9D1f6dC6BcA46E4C227AA7CA
```

**Key Features:**
- ✅ Reads projects directly from blockchain
- ✅ No API required
- ✅ Always up-to-date
- ✅ Decentralized

**Functions Used:**
```typescript
// Get all projects
getAllProjects() → Project[]

// Get single project
getProject(projectId) → Project

// Get project by slug
getProjectBySlug(slug) → Project
```

### **What This Means:**

- ✅ **No database needed** - Registry is on-chain
- ✅ **No backend API** - Direct contract calls
- ✅ **Admin updates reflected instantly** - Blockchain is source of truth

---

## 🚢 Deployment Steps

### **1. Push to Git:**

```bash
cd /Users/nationalbank/Library/Containers/com.hp.PSDrMonitor/Data/tmp/otcx
git add .
git commit -m "Remove Grok API, finalize V4 deployment"
git push origin main
```

### **2. Connect Netlify to Your Repo:**

1. Go to Netlify Dashboard
2. Click "Add new site" → "Import an existing project"
3. Connect to your Git provider (GitHub/GitLab/etc.)
4. Select the `otcx` repository

### **3. Configure Build Settings:**

Netlify should auto-detect from `netlify.toml`, but verify:

- **Base directory**: (leave empty)
- **Build command**: `cd frontend && npm install && npm run build`
- **Publish directory**: `frontend/.next`
- **Node version**: `22`

### **4. Add Environment Variables:**

Copy all variables from the section above into:
**Site Settings → Environment Variables → Add a variable**

⚠️ **Important**: Make sure to set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`!

### **5. Deploy:**

Click **"Deploy site"** → Netlify will build and deploy automatically

---

## 🧪 Testing Checklist

Once deployed to `otcx.fun`, test the following:

### **Core Functionality:**
- [ ] Connect wallet (RainbowKit)
- [ ] Switch to Sepolia network
- [ ] Mint test USDC
- [ ] View all projects (from Registry)
- [ ] Create a buy order
- [ ] Create a sell order
- [ ] Take an existing order
- [ ] View dashboard orders

### **Admin Functions:**
- [ ] Access `/admin` page
- [ ] Add new project to Registry
- [ ] Edit existing project
- [ ] Activate TGE for a project
- [ ] Set conversion ratio (for points projects)

### **Multichain (Future):**
- [ ] Switch to different network in wallet
- [ ] Verify network not supported message appears
- [ ] Enable other chains by setting `enabled: true` in `chains.ts`

---

## 🔐 Security Notes

### **Public vs Private Variables:**

**Public** (prefixed with `NEXT_PUBLIC_`):
- Contract addresses
- RPC URLs
- WalletConnect Project ID
- ✅ These are safe to expose (embedded in client JS)

**Private** (no prefix - if you add any backend features):
- Private keys
- API secrets
- Admin credentials
- ⚠️ These should NEVER be `NEXT_PUBLIC_`

### **Current Setup:**

✅ **All variables are `NEXT_PUBLIC_`** because:
- This is a **100% client-side dApp**
- No private backend
- No secrets to protect
- Users sign with their own wallets

---

## 📊 Monitoring

### **Key Metrics to Watch:**

1. **Build Time**: Should be ~2-3 minutes
2. **Deploy Time**: ~30 seconds
3. **Bundle Size**: Frontend is optimized with Next.js
4. **Function Calls**: All contract calls via user's wallet (no serverless functions)

### **Logs to Check:**

- **Deploy logs**: Site Settings → Deploys → (Select deploy) → Deploy log
- **Function logs**: (None - no serverless functions)
- **Browser console**: Check for RPC errors or contract call failures

---

## 🛠️ Troubleshooting

### **Issue: Wallet Won't Connect**

**Solution**: Make sure `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set

---

### **Issue: "Network Not Supported"**

**Solution**: User needs to switch to Sepolia in their wallet

---

### **Issue: No Projects Loading**

**Solution**: 
1. Check Registry address in env vars
2. Verify Registry has projects: `cast call 0x76E06a3b4e1E42eB9D1f6dC6BcA46E4C227AA7CA "projectCount()(uint256)" --rpc-url sepolia`

---

### **Issue: Can't Create Orders**

**Solution**:
1. Check Orderbook address in env vars
2. Ensure user has USDC: Mint via navbar button
3. Check if project is active in Registry

---

### **Issue: Build Fails**

**Solution**:
1. Check Node version is 22
2. Verify `netlify.toml` is in root directory
3. Check deploy logs for specific errors

---

## 🎯 Post-Deployment

### **Immediate:**
1. ✅ Test all core features on live site
2. ✅ Share with beta testers
3. ✅ Monitor Netlify dashboard for errors

### **Next Steps:**
1. **Mainnet Deployment**:
   - Deploy contracts to Arbitrum/Base
   - Update `chains.ts` with mainnet addresses
   - Set `enabled: true` for mainnet chains
   - Update Netlify env vars

2. **Domain Setup**:
   - Verify `otcx.fun` is connected
   - Add SSL certificate (Netlify auto-provisions)
   - Set up redirects if needed

3. **Analytics** (optional):
   - Add Google Analytics or Plausible
   - Track wallet connections
   - Monitor order volume

---

## 📚 Key Files Reference

| File | Purpose | Location |
|------|---------|----------|
| `netlify.toml` | Build config | Root directory |
| `chains.ts` | Chain configs | `frontend/src/lib/chains.ts` |
| `contracts.ts` | Contract ABIs | `frontend/src/lib/contracts.ts` |
| `wagmi.ts` | Web3 config | `frontend/src/lib/wagmi.ts` |

---

## ✅ Current Status

### **Removed:**
- ❌ Grok API integration
- ❌ Grok environment variables
- ❌ AI analysis features

### **Kept:**
- ✅ V4 contracts (with conversion ratio)
- ✅ On-chain Registry
- ✅ Multichain-ready architecture
- ✅ RainbowKit wallet connection
- ✅ Admin panel
- ✅ TGE settlement system

### **Ready for Production:**
- ✅ No external API dependencies
- ✅ 100% decentralized
- ✅ Clean, optimized codebase
- ✅ Sepolia testnet fully configured

---

## 🚀 Deploy Command Summary

```bash
# Set env vars in Netlify Dashboard first!
# Then just push to git - Netlify auto-deploys

git add .
git commit -m "Production ready: V4 contracts, Grok removed"
git push origin main
```

**Netlify will automatically:**
1. Detect the push
2. Run build command
3. Deploy to otcx.fun
4. Provision SSL
5. Invalidate CDN cache

---

## 📞 Support Resources

- **Netlify Docs**: https://docs.netlify.com/
- **Next.js on Netlify**: https://docs.netlify.com/frameworks/next-js/
- **RainbowKit Docs**: https://rainbowkit.com/docs/
- **Wagmi Docs**: https://wagmi.sh/

---

## 🎉 You're Ready to Deploy!

Once env vars are set in Netlify, just push to git and your site will be live at **otcx.fun** 🚀

All contract interactions happen directly from the user's wallet - no backend needed!

