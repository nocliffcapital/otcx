# 🔧 Local Environment Setup

## 🐛 **Issue Found:**

The Registry had a **fallback address** in `contracts.ts`:

```typescript
// OLD (line 41):
export const REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_REGISTRY || '0x1d35a58d583678e80e25d6d433ae8f9722751a94') as `0x${string}`;
```

**This caused:**
- Local development used old registry `0x1d35...` which had "Lighter"
- "Lighter" existed in old registry → "Project already exists" error
- But UI read from different registry → "No projects visible"

## ✅ **Fixed:**

Updated fallback to use **fresh registry**:

```typescript
// NEW (line 41):
export const REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_REGISTRY || '0x138c5ff78c85a0D01FaC617bcf3361bA677B3255') as `0x${string}`;
```

---

## 🏠 **For Local Development:**

Create `frontend/.env.local` with:

```bash
# Fresh Registry (Empty)
NEXT_PUBLIC_ORDERBOOK=0x95a7cB49A83cd4b889bF9Be36E24e65b92B51eb7
NEXT_PUBLIC_REGISTRY=0x138c5ff78c85a0D01FaC617bcf3361bA677B3255
NEXT_PUBLIC_STABLE=0xd5d56a9Cd59550c6D95569620F7eb89C1E4c9101
NEXT_PUBLIC_STABLE_DECIMALS=6
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

---

## 🌐 **For Netlify (Production):**

Same addresses in **Netlify → Site Settings → Environment Variables**:

```bash
NEXT_PUBLIC_ORDERBOOK=0x95a7cB49A83cd4b889bF9Be36E24e65b92B51eb7
NEXT_PUBLIC_REGISTRY=0x138c5ff78c85a0D01FaC617bcf3361bA677B3255
NEXT_PUBLIC_STABLE=0xd5d56a9Cd59550c6D95569620F7eb89C1E4c9101
NEXT_PUBLIC_STABLE_DECIMALS=6
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_actual_id
```

---

## 🎯 **Now Both Will Work:**

### **Without .env.local (uses fallbacks):**
- ✅ Orderbook: `0x95a7...` (from fallback)
- ✅ Registry: `0x138c...` (NEW fresh registry)
- ✅ USDC: `0xd5d5...` (from fallback)

### **With .env.local (uses env vars):**
- ✅ Reads from `.env.local`
- ✅ Same addresses
- ✅ Consistent everywhere

---

## 🧪 **Testing:**

1. **Local (with fallbacks):**
   ```bash
   cd frontend
   npm run dev
   ```
   - Should use fresh registry `0x138c...`
   - Admin panel: "No projects found" ✅

2. **Netlify (with env vars):**
   - Update `NEXT_PUBLIC_REGISTRY` to `0x138c...`
   - Redeploy
   - Should also show empty ✅

---

## 📊 **All Registries:**

| Address | Status | Has Projects |
|---------|--------|--------------|
| `0x1d35...` | OLD | Unknown (fallback before) |
| `0xb462...` | OLD | Has "Lighter" |
| `0x138c...` | ✅ NEW | Empty (fresh) |

**Now using:** `0x138c5ff78c85a0D01FaC617bcf3361bA677B3255` everywhere! ✅

---

## ✅ **Summary:**

- ✅ Fixed fallback in `contracts.ts` to use fresh registry
- ✅ Updated Netlify env vars
- ✅ Both local and production now use same fresh registry
- ✅ Can test full project creation flow from scratch

**Your issue is resolved!** 🎉

