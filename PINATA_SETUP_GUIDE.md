# Pinata IPFS Setup Guide

Complete guide for uploading logos and metadata to Pinata IPFS.

---

## 🚀 Quick Setup

### 1. Sign Up for Pinata
1. Go to https://pinata.cloud
2. Create a free account
3. Navigate to **API Keys** in the dashboard
4. Click **New Key** → Enable "pinFileToIPFS" and "pinJSONToIPFS"
5. Copy your API Key and Secret

### 2. Add to Environment Variables

```bash
# frontend/.env.local
PINATA_API_KEY=your_api_key_here
PINATA_SECRET_KEY=your_secret_key_here
```

### 3. Restart Dev Server
```bash
cd frontend
npm run dev
```

---

## 📝 How It Works

### Upload Flow
```
1. User uploads logo file (PNG/JPG/etc.)
   ↓
2. Frontend → /api/pinata/upload-file
   ↓
3. API uploads to Pinata → Returns CID
   ↓
4. Frontend creates metadata with logo IPFS URL
   ↓
5. Frontend → /api/pinata/upload-json
   ↓
6. API uploads metadata → Returns CID
   ↓
7. Frontend calls registry.addProject(metadataURI)
```

---

## 💻 Usage Example

### In Admin Panel (Add Project Form)

```typescript
import { uploadImageToPinata, uploadMetadataToPinata } from '@/lib/pinata';

async function handleAddProject(formData: FormData) {
  try {
    // 1. Upload logo file to Pinata
    const logoFile = formData.get('logo') as File;
    const logoCID = await uploadImageToPinata(logoFile);
    const logoUrl = `ipfs://${logoCID}`;
    
    console.log('Logo uploaded:', logoUrl);
    // Example: ipfs://QmX7k3dR2... 
    
    // 2. Create metadata object
    const metadata = {
      slug: formData.get('slug') as string,
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      twitterUrl: formData.get('twitter') as string,
      websiteUrl: formData.get('website') as string,
      logoUrl: logoUrl,  // IPFS URL from step 1
      tags: ['DeFi', 'DEX'] // optional
    };
    
    // 3. Upload metadata JSON to Pinata
    const metadataCID = await uploadMetadataToPinata(metadata);
    const metadataURI = `ipfs://${metadataCID}`;
    
    console.log('Metadata uploaded:', metadataURI);
    // Example: ipfs://QmY8m4eS3...
    
    // 4. Register project on-chain
    const projectId = keccak256(toUtf8Bytes(metadata.slug));
    
    await registryContract.addProject(
      metadata.slug,
      metadata.name,
      '0x0000000000000000000000000000000000000000', // token address (not deployed yet)
      false, // isPoints
      metadataURI // ipfs://QmY8m4eS3...
    );
    
    console.log('Project registered on-chain!');
    
  } catch (error) {
    console.error('Error adding project:', error);
    alert('Failed to add project: ' + error.message);
  }
}
```

### Display Logo in Frontend

```typescript
import { ipfsToHttp, getOptimizedImageUrl } from '@/lib/pinata';

function ProjectCard({ project }: { project: Project }) {
  // Fetch metadata from IPFS
  const [metadata, setMetadata] = useState(null);
  
  useEffect(() => {
    async function loadMetadata() {
      const response = await fetch(
        ipfsToHttp(project.metadataURI)
      );
      const data = await response.json();
      setMetadata(data);
    }
    loadMetadata();
  }, [project.metadataURI]);
  
  if (!metadata) return <div>Loading...</div>;
  
  return (
    <div>
      <img 
        src={getOptimizedImageUrl(metadata.logoUrl, { width: 200 })}
        alt={metadata.name}
      />
      <h2>{metadata.name}</h2>
      <p>{metadata.description}</p>
      <a href={metadata.twitterUrl}>Twitter</a>
      <a href={metadata.websiteUrl}>Website</a>
    </div>
  );
}
```

---

## 🎨 Logo Upload Component Example

```tsx
'use client';

import { useState } from 'react';
import { uploadImageToPinata } from '@/lib/pinata';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function LogoUploader({ onUpload }: { onUpload: (cid: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    // Upload to Pinata
    try {
      setUploading(true);
      const cid = await uploadImageToPinata(file);
      onUpload(cid);
      alert('Logo uploaded successfully!');
    } catch (error) {
      alert('Failed to upload logo: ' + error.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="block mb-2 font-medium">Project Logo</label>
      
      {preview && (
        <img 
          src={preview} 
          alt="Preview" 
          className="w-32 h-32 object-cover rounded mb-4"
        />
      )}
      
      <Input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={uploading}
      />
      
      {uploading && <p className="mt-2 text-sm text-gray-500">Uploading to IPFS...</p>}
    </div>
  );
}
```

---

## 🔍 What Gets Stored Where

### Logo File (uploaded to Pinata)
- **Location:** IPFS (via Pinata)
- **URL:** `ipfs://QmX7k3dR2aBcDeFg...` (46 characters)
- **Content:** Raw image bytes (PNG, JPG, etc.)
- **Size:** Depends on image (typically 10-500KB)
- **Retrievable via:** 
  - `https://gateway.pinata.cloud/ipfs/QmX7k3dR2...`
  - Any IPFS gateway

### Metadata JSON (uploaded to Pinata)
```json
{
  "slug": "lighter",
  "name": "Lighter",
  "description": "Full project description here...",
  "twitterUrl": "https://x.com/lighter",
  "websiteUrl": "https://lighter.xyz",
  "logoUrl": "ipfs://QmX7k3dR2aBcDeFg...",
  "tags": ["DeFi", "DEX"]
}
```
- **Location:** IPFS (via Pinata)
- **URL:** `ipfs://QmY8m4eS3...` (stored on-chain)
- **Size:** ~500 bytes
- **Cost:** ~10k gas to store the URI on-chain

### On-Chain (ProjectRegistryV2)
```solidity
{
  id: bytes32(keccak256("lighter")),
  name: "Lighter",
  tokenAddress: 0x0,
  isPoints: false,
  active: true,
  metadataURI: "ipfs://QmY8m4eS3..."  // ← Only this stored on-chain!
}
```
- **Location:** Blockchain
- **Size:** ~150 bytes
- **Cost:** ~80k gas (~$2 @ 25 gwei)

---

## 🎯 Benefits of This Approach

### Decentralization
- ✅ Logos can't be censored or taken down
- ✅ Works even if your website goes offline
- ✅ Content-addressed (CID = hash of content)

### Cost Efficiency
- ✅ Only IPFS link stored on-chain (not full metadata)
- ✅ 90% cheaper than storing everything on-chain
- ✅ Free IPFS hosting via Pinata (1GB free tier)

### Performance
- ✅ Fast loading via Pinata's dedicated gateways
- ✅ Images are cached globally
- ✅ Can optimize images with query parameters

### Flexibility
- ✅ Can update metadata off-chain (new IPFS upload + contract update)
- ✅ No size limits on descriptions
- ✅ Can add videos, documents, etc. in the future

---

## 🔐 Security Notes

### File Validation
- ✅ Only images allowed (MIME type check)
- ✅ Max 5MB file size
- ✅ Pinata scans for malware

### API Keys
- ⚠️ Keep `PINATA_SECRET_KEY` in `.env.local` (never commit!)
- ✅ API routes run server-side (keys not exposed to client)
- ✅ Free tier has rate limits (prevents abuse)

### Content Addressing
- ✅ CID is cryptographic hash of content
- ✅ If content changes, CID changes
- ✅ Impossible to replace content without changing URL

---

## 📊 Cost Breakdown

### Free Tier (Plenty for MVP)
- **Storage:** 1GB (thousands of logos)
- **Bandwidth:** 10GB/month (millions of views)
- **Pins:** Unlimited
- **Requests:** 180 per minute

### If You Outgrow Free Tier
- **Picnic Plan:** $20/month
  - 100GB storage
  - 100GB bandwidth
  - Dedicated gateway (faster)

---

## 🧪 Testing

### Test Upload Locally
```bash
cd frontend
npm run dev

# Then in admin panel:
# 1. Click "Add Project"
# 2. Upload a test logo (PNG/JPG)
# 3. Check console for IPFS CID
# 4. Visit https://gateway.pinata.cloud/ipfs/<CID>
# 5. Verify image loads
```

### Test Metadata
```bash
# After uploading metadata:
curl https://gateway.pinata.cloud/ipfs/<metadata-CID>

# Should return JSON:
{
  "slug": "lighter",
  "name": "Lighter",
  "logoUrl": "ipfs://..."
}
```

---

## ❓ Troubleshooting

### "IPFS upload not configured"
→ Check `.env.local` has `PINATA_API_KEY` and `PINATA_SECRET_KEY`
→ Restart dev server after adding env vars

### "Failed to upload to IPFS"
→ Check Pinata API keys are valid
→ Check free tier limits (1GB storage, 10GB bandwidth)
→ Check file is under 5MB

### Logo not loading
→ Check IPFS gateway is reachable: https://gateway.pinata.cloud/ipfs/<CID>
→ Try alternate gateway: https://ipfs.io/ipfs/<CID>
→ Check browser console for CORS errors

### Slow loading
→ First load can be slow (IPFS propagation)
→ Subsequent loads are cached
→ Consider using Pinata's dedicated gateway (paid plan)

---

## 🎉 You're Ready!

You now have:
- ✅ Pinata setup with API keys
- ✅ Upload endpoints for files and JSON
- ✅ Helper functions for IPFS URLs
- ✅ Admin panel integration example

Next steps:
1. Sign up for Pinata
2. Add API keys to `.env.local`
3. Test logo upload in admin panel
4. Deploy to production!

