# V3 Contract Addresses (Sepolia)

These are the deployed V3 smart contract addresses on Ethereum Sepolia testnet.

## Contract Addresses

- **ProjectRegistryV2**: `0x0da2c01facdce47a161ea4eb6aa05fdb49a79f17`
- **EscrowOrderBookV3**: `0x64fba4608e8cfa61e41f06fcf37c770a7866edfd`
- **MockUSDC (Stable)**: `0xd5d56a9Cd59550c6D95569620F7eb89C1E4c9101`

## Environment Variables

### For Local Development

Create a `frontend/.env.local` file with:

```bash
# V3 Contract Addresses on Sepolia
NEXT_PUBLIC_REGISTRY=0x0da2c01facdce47a161ea4eb6aa05fdb49a79f17
NEXT_PUBLIC_ORDERBOOK=0x64fba4608e8cfa61e41f06fcf37c770a7866edfd
NEXT_PUBLIC_STABLE=0xd5d56a9Cd59550c6D95569620F7eb89C1E4c9101
NEXT_PUBLIC_STABLE_DECIMALS=6

# RPC
NEXT_PUBLIC_RPC=https://rpc.ankr.com/eth_sepolia

# API Keys (add your actual keys)
GROK_API_KEY=your_actual_grok_api_key
PINATA_JWT=your_actual_pinata_jwt
```

### For Netlify Deployment

Make sure these environment variables are set in your Netlify dashboard:

1. `NEXT_PUBLIC_REGISTRY` = `0x0da2c01facdce47a161ea4eb6aa05fdb49a79f17`
2. `NEXT_PUBLIC_ORDERBOOK` = `0x64fba4608e8cfa61e41f06fcf37c770a7866edfd`
3. `NEXT_PUBLIC_STABLE` = `0xd5d56a9Cd59550c6D95569620F7eb89C1E4c9101`
4. `NEXT_PUBLIC_STABLE_DECIMALS` = `6`
5. `NEXT_PUBLIC_RPC` = `https://rpc.ankr.com/eth_sepolia`
6. `GROK_API_KEY` = (your actual Grok API key)
7. `PINATA_JWT` = (your actual Pinata JWT token)

## Deployment Info

- **Deployed on**: Sepolia (Chain ID: 11155111)
- **Deployment Transaction**:
  - Registry: `0x5b0d73484d428971ec131d766a6b1545306fd02349febfc202f54524cd28f006`
  - Orderbook: `0xd5d81e8c1a3db065b0f01f76e2aed05bc0ef4da0f4b020f715626af9ba1e6ed5`
- **Block**: 9466998 (0x907076)
- **Deployer**: `0x61fedd6bc4ef1ab11cf8b6cc8f9b4faeb41b6f55`

## Notes

- These contracts are using **V3** architecture with:
  - `bytes32` project IDs (instead of addresses)
  - Solady libraries for gas optimization
  - IPFS metadata storage
  - Combined take+deposit transactions
  - Auto-settlement on token deposit

