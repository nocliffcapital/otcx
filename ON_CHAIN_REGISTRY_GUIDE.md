# On-Chain Project Registry Guide

## Overview

Your otcX platform now uses a **fully decentralized on-chain registry** for managing projects. Projects are stored in the `ProjectRegistry` smart contract on Sepolia, making the platform trustless and censorship-resistant.

## Deployed Contract

**ProjectRegistry**: `0x5DC0110b057331018693FfCf96983Fd02c91ad0e`

[View on Sepolia Etherscan](https://sepolia.etherscan.io/address/0x5DC0110b057331018693FfCf96983Fd02c91ad0e)

## How It Works

### 1. Smart Contract Storage
Projects are stored on-chain with the following data:
- `slug`: URL-friendly identifier (e.g., "eigen")
- `name`: Display name (e.g., "EigenLayer")
- `tokenAddress`: Expected token contract address
- `assetType`: "Points" or "Tokens"
- `active`: Whether the project is currently tradeable
- `addedAt`: Timestamp when added

### 2. Frontend Integration
The frontend (`/app` page) automatically reads from the registry:
```typescript
const { data: projects } = useReadContract({
  address: REGISTRY_ADDRESS,
  abi: PROJECT_REGISTRY_ABI,
  functionName: "getActiveProjects",
});
```

The project detail page (`/project/[slug]`) fetches the specific project and uses its token address for orders.

### 3. Initial Projects
These 6 projects were added during deployment:
- **eigen** - EigenLayer (Points)
- **blast** - Blast (Points)
- **zksync** - zkSync (Tokens)
- **starknet** - Starknet (Tokens)
- **scroll** - Scroll (Tokens)
- **linea** - Linea (Points)

## Managing Projects

### Prerequisites
- You must be the **contract owner** (deployer address)
- Have Sepolia ETH for gas
- Have `cast` (Foundry CLI) installed

### Add a New Project

```bash
# Set environment variables
export REGISTRY_ADDRESS=0x5DC0110b057331018693FfCf96983Fd02c91ad0e
export SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your-key
export PRIVATE_KEY=your-private-key

# Add project
cast send $REGISTRY_ADDRESS \
  "addProject(string,string,address,string)" \
  "arbitrum" "Arbitrum" "0x912CE59144191C1204E64559FE8253a0e49E6548" "Tokens" \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```

**Parameters:**
- `slug`: Lowercase, no spaces (e.g., "arbitrum")
- `name`: Display name (e.g., "Arbitrum")
- `tokenAddress`: Token contract address (use `address(0)` if not deployed yet)
- `assetType`: Must be exactly "Points" or "Tokens"

### Update an Existing Project

```bash
cast send $REGISTRY_ADDRESS \
  "updateProject(string,string,address,string)" \
  "arbitrum" "Arbitrum Updated" "0x..." "Points" \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```

### Disable a Project

```bash
cast send $REGISTRY_ADDRESS \
  "setProjectStatus(string,bool)" \
  "arbitrum" false \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```

This removes it from the active projects list (won't show on frontend).

### Re-enable a Project

```bash
cast send $REGISTRY_ADDRESS \
  "setProjectStatus(string,bool)" \
  "arbitrum" true \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```

### View Projects

**Get all active projects:**
```bash
cast call $REGISTRY_ADDRESS \
  "getActiveProjects()" \
  --rpc-url $SEPOLIA_RPC_URL
```

**Get a specific project:**
```bash
cast call $REGISTRY_ADDRESS \
  "getProject(string)" \
  "eigen" \
  --rpc-url $SEPOLIA_RPC_URL
```

**Get total project count:**
```bash
cast call $REGISTRY_ADDRESS \
  "getProjectCount()" \
  --rpc-url $SEPOLIA_RPC_URL
```

## Transfer Ownership

If you want to transfer control to another address:

```bash
cast send $REGISTRY_ADDRESS \
  "transferOwnership(address)" \
  "0xNewOwnerAddress" \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```

## Security Considerations

1. **Only owner can add/update projects**: This prevents spam and malicious projects
2. **Projects are permanent**: Once added, they can be disabled but not deleted (for transparency)
3. **Token addresses are verified**: The contract validates that asset type is either "Points" or "Tokens"
4. **Slugs must be unique**: Cannot add duplicate projects

## Testing

Run the registry tests:
```bash
cd contracts
~/.foundry/bin/forge test --match-contract ProjectRegistryTest -vv
```

All 9 tests should pass ✅

## Advantages of On-Chain Registry

✅ **Fully Decentralized**: No centralized database or API  
✅ **Transparent**: Anyone can read the project list  
✅ **Censorship Resistant**: Projects can't be removed arbitrarily  
✅ **Trustless**: Users verify projects directly on-chain  
✅ **Permanent History**: All changes are recorded on the blockchain  

## Next Steps

To add your own projects:
1. Prepare the project details (slug, name, token address, type)
2. Use the `cast send` commands above
3. Refresh the frontend - new projects appear automatically!

No code changes or redeployment needed. 🎉


