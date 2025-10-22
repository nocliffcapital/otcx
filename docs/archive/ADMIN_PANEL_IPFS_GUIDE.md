# Admin Panel - Automatic IPFS Upload Guide

## ✅ What I Built

The admin panel now **automatically handles everything** when you add a project. Just fill out the form, and behind the scenes it:

1. ✅ Uploads logo to Pinata → Gets IPFS CID
2. ✅ Uploads metadata to Pinata → Gets IPFS CID  
3. ✅ Registers on blockchain with IPFS links
4. ✅ Shows progress for each step

**You just fill the form and click "Add Project" - everything else is automatic!**

---

## 🎨 What the Admin Sees

### Step-by-Step Flow

```
┌─────────────────────────────────────────┐
│   1. Fill out project details          │
│   - Name: "Lighter"                    │
│   - Slug: "lighter"                    │
│   - Twitter, Website, Description      │
│   - Upload logo (drag & drop or click) │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│   2. Click "Add Project"                │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│   📤 Step 1/3: Uploading logo to IPFS   │
│   (Shows animated upload icon)          │
│   ✅ Logo uploaded: ipfs://QmX7k...     │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│   📤 Step 2/3: Uploading metadata       │
│   (Shows animated upload icon)          │
│   ✅ Metadata uploaded: ipfs://QmY8...  │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│   ⏳ Step 3/3: Blockchain confirmation   │
│   (Wallet pops up for signature)        │
│   ✅ Project added successfully!        │
└─────────────────────────────────────────┘
```

---

## 🖼️ Logo Upload Features

### Visual Preview
- **Live preview** of uploaded logo (24x24 thumbnail)
- **Remove button** (× in top-right corner)
- **File info** showing name and size

### Drag & Drop Area
```
┌──────────────────────────────────┐
│         📤 Upload Icon           │
│   Click to upload logo           │
│ PNG, JPG, GIF, or WebP (max 5MB) │
└──────────────────────────────────┘
```

### Validation
- ✅ Only allows images (PNG, JPG, GIF, WebP)
- ✅ Max 5MB file size
- ✅ Shows error if invalid file
- ✅ Shows file name and size after upload

---

## 🔄 Behind the Scenes (Automatic)

### What Happens When You Click "Add Project"

```typescript
// 1. Upload logo (if provided)
if (logoFile) {
  const logoCID = await uploadImageToPinata(logoFile);
  // Result: ipfs://QmX7k3dR2aBcDeFg...
}

// 2. Create and upload metadata
const metadata = {
  slug: "lighter",
  name: "Lighter",
  description: "...",
  twitterUrl: "https://x.com/lighter",
  websiteUrl: "https://lighter.xyz",
  logoUrl: "ipfs://QmX7k3dR2...",  // From step 1
  assetType: "Tokens"
};

const metadataCID = await uploadMetadataToPinata(metadata);
// Result: ipfs://QmY8m4eS3xYz...

// 3. Register on blockchain
await registry.addProject(
  "lighter",
  "Lighter",
  "0x0",           // Token address (optional)
  "Tokens",
  "...",           // Twitter
  "...",           // Website
  "...",           // Description
  "ipfs://QmX7..."  // Logo IPFS URL
);
```

**You never see this code - it all happens automatically!**

---

## 📋 Form Fields

### Required Fields
- **Project Name** - Display name (e.g., "Lighter")
- **Slug** - URL-friendly ID (e.g., "lighter")
- **Asset Type** - "Tokens" or "Points"

### Optional Fields
- **Token Address** - If already deployed
- **Twitter URL** - Project's X/Twitter
- **Website URL** - Official website
- **Description** - Brief project description
- **Logo** - Project logo image

---

## 🎯 Progress Indicators

### Button States

| State | Button Text | Icon |
|-------|-------------|------|
| **Idle** | "Add Project" | - |
| **Logo Upload** | "Uploading logo to IPFS..." | 📤 (animated) |
| **Metadata Upload** | "Uploading metadata to IPFS..." | 📤 (animated) |
| **Blockchain** | "Processing..." | - |
| **Success** | "Add Project" | ✅ |

### Progress Messages

```
📤 Step 1/3: Uploading logo to IPFS...
   ↓
📤 Step 2/3: Uploading metadata to IPFS...
   ↓
⏳ Step 3/3: Waiting for blockchain confirmation...
   ↓
✓ Project added successfully!
```

---

## 🚨 Error Handling

### Logo Upload Errors
- Invalid file type → Alert: "Invalid file type. Please upload an image..."
- File too large → Alert: "File too large. Maximum size is 5MB."
- Upload failed → Alert: "Failed to upload logo: [error message]"

### Metadata Upload Errors
- Upload failed → Alert: "Failed to upload metadata: [error message]"

### Blockchain Errors
- Transaction rejected → Alert: "Failed to add project. See console for details."

**All errors are shown as alerts with clear messages.**

---

## 🧪 Testing Checklist

### Before First Use
1. ✅ Add `PINATA_API_KEY` and `PINATA_SECRET_KEY` to `.env.local`
2. ✅ Restart dev server
3. ✅ Connect wallet to admin panel
4. ✅ Verify you're the owner

### Test Flow
1. ✅ Click "Add New Project"
2. ✅ Fill out form (name, slug, description)
3. ✅ Upload a logo (drag & drop or click)
4. ✅ See logo preview
5. ✅ Click "Add Project"
6. ✅ See "Step 1/3: Uploading logo..."
7. ✅ See "Step 2/3: Uploading metadata..."
8. ✅ Wallet pops up → Sign transaction
9. ✅ See "✓ Project added successfully!"
10. ✅ Project appears in list below

### Verify IPFS Upload
```bash
# Check console logs for IPFS URLs
✅ Logo uploaded to IPFS: ipfs://QmX7k3dR2...
✅ Metadata uploaded to IPFS: ipfs://QmY8m4eS3...

# Visit in browser
https://gateway.pinata.cloud/ipfs/<CID>
```

---

## 💡 Tips

### Logo Best Practices
- **Square images work best** (e.g., 512x512)
- **PNG with transparency** for best results
- **Keep under 500KB** for fast loading
- **Use high-quality** source files

### Slug Best Practices
- **Lowercase only** (auto-converted)
- **Use hyphens** for spaces (e.g., "my-project")
- **Keep short** (under 20 characters)
- **Cannot change** after creation

### Description Tips
- **Keep under 200 characters** for best display
- **No markdown** (plain text only)
- **Include key value prop** (what makes it unique)

---

## 🎉 You're Ready!

The admin panel now:
- ✅ **Automatically uploads logos to IPFS**
- ✅ **Automatically uploads metadata to IPFS**
- ✅ **Shows progress for each step**
- ✅ **Handles errors gracefully**
- ✅ **Provides visual feedback**

**Just fill the form and click "Add Project" - everything else is magic!** ✨

---

## 📝 Next Steps

1. Sign up for Pinata: https://pinata.cloud
2. Add API keys to `.env.local`:
   ```bash
   PINATA_API_KEY=your_key_here
   PINATA_SECRET_KEY=your_secret_here
   ```
3. Restart dev server: `npm run dev`
4. Test adding a project with a logo!

