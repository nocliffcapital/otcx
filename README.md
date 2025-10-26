# otcX - Pre-TGE OTC Trading Platform

**Live Site**: [otcx.fun](https://otcx.fun)

A decentralized platform for trading token allocations before Token Generation Events (TGE), supporting both on-chain tokens and off-chain points systems.

---

## Quick Start

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:3000`

### Smart Contract Development
```bash
cd contracts
forge build
forge test
```

---

## Project Structure

```
otcx/
├── frontend/           # Next.js 15 + wagmi + RainbowKit
│   ├── src/
│   │   ├── app/       # Pages & routes
│   │   ├── components/# UI components
│   │   ├── hooks/     # Custom React hooks
│   │   └── lib/       # Utilities & contract ABIs
│   └── public/        # Static assets
└── contracts/         # Foundry smart contracts
    ├── src/           # V4 production contracts
    ├── test/          # Test suites
    └── script/        # Deployment scripts
```

---

## Smart Contracts (V4)

### Sepolia Testnet

| Contract | Address | Purpose |
|----------|---------|---------|
| **ProjectRegistryV2** | `0x7fdBE0DEA92E1e246276DCb50c6d7Dc910563D22` | Project metadata & management |
| **EscrowOrderBookV4** | `0x1560B643159F2184B9b416D822fAc1A05769af2F` | Order creation, matching & settlement |
| **Mock USDC** | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | Test stablecoin (Sepolia) |

### Key Features
- 100% collateral escrow system
- IPFS metadata storage
- Solady security libraries
- Single-transaction order execution
- Dynamic fee management
- Private order URLs

---

## Technology Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS
- **Web3**: wagmi v2 + viem + RainbowKit
- **State**: React Hooks
- **Deployment**: Netlify

### Smart Contracts
- **Framework**: Foundry
- **Language**: Solidity 0.8.24
- **Libraries**: Solady (Ownable, Pausable, ReentrancyGuard)
- **Network**: Ethereum Sepolia (testnet)
- **Storage**: IPFS via Pinata

---

## Core Features

### For Traders
- **Create Orders**: List token allocations for sale or post buy offers
- **Browse Markets**: Explore pre-TGE projects (Tokens & Points)
- **Escrow Safety**: 100% collateral-backed trades with smart contract protection
- **TGE Settlement**: Automatic settlement after token launch
- **Private Orders**: Share custom order links with specific counterparties

### For Admins
- **Project Management**: Add/edit projects via on-chain registry
- **IPFS Integration**: Upload logos/metadata to Pinata
- **TGE Activation**: Batch activate settlement for multiple orders
- **Fee Management**: Adjust settlement and cancellation fees dynamically
- **Emergency Controls**: Pause/unpause trading

---

## Testing

### Run Contract Tests
```bash
cd contracts
forge test -vvv
```

### Generate Gas Report
```bash
forge test --gas-report
```

---

## Deployment

### Deploy Contracts (Sepolia)
```bash
cd contracts
source .env
forge script script/DeployV4.s.sol --rpc-url sepolia --broadcast --verify
```

### Deploy Frontend (Netlify)
Connected to GitHub `main` branch for automatic deployments.

**Required Environment Variables:**
```
NEXT_PUBLIC_ORDERBOOK=0x...
NEXT_PUBLIC_STABLE=0x...
NEXT_PUBLIC_REGISTRY=0x...
NEXT_PUBLIC_STABLE_DECIMALS=6
NEXT_PUBLIC_RPC=https://ethereum-sepolia-rpc.publicnode.com
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
PINATA_JWT=...
```

---

## Development Workflow

### 1. Make Changes
```bash
# Contracts
cd contracts
# Edit src/*.sol
forge build
forge test

# Frontend
cd frontend
# Edit src/**/*.tsx
npm run dev
```

### 2. Test Changes
```bash
# Contracts
forge test -vvv

# Frontend
npm run build  # Check for build errors
```

### 3. Commit & Push
```bash
git add .
git commit -m "description of changes"
git push origin main
```

---

## License

Proprietary - All Rights Reserved

---

## Links

- **Website**: [otcx.fun](https://otcx.fun)
- **Network**: Ethereum Sepolia (Testnet)
