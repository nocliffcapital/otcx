# otcX - Pre-TGE OTC Trading Platform

**Live Site**: [otcx.fun](https://otcx.fun) | **Docs**: [docs.otcx.fun](https://docs.otcx.fun)

A decentralized platform for trading token allocations before Token Generation Events (TGE), supporting both on-chain tokens and off-chain points systems.

---

## 🚀 Quick Start

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
forge lint
```

---

## 📁 Project Structure

```
otcx/
├── frontend/           # Next.js 15 + wagmi + RainbowKit
│   ├── src/
│   │   ├── app/       # Pages & routes
│   │   ├── components/# UI components
│   │   ├── hooks/     # Custom React hooks
│   │   └── lib/       # Utilities & contract ABIs
│   └── public/        # Static assets
├── contracts/         # Foundry smart contracts
│   ├── src/           # V3 production contracts
│   ├── test/          # Test suites
│   └── script/        # Deployment scripts
└── docs/              # Documentation
    └── archive/       # Historical docs
```

---

## 🔗 Smart Contracts (V3)

### Deployed on Sepolia Testnet

| Contract | Address | Purpose |
|----------|---------|---------|
| **ProjectRegistryV2** | `0x[...]` | Project metadata & management |
| **EscrowOrderBookV3** | `0x[...]` | Order creation, matching & settlement |
| **Mock USDC** | `0x[...]` | Test stablecoin (Sepolia) |

**Key V3 Features:**
- ✅ `bytes32` project identifiers (no placeholder addresses)
- ✅ IPFS metadata storage via Pinata
- ✅ Solady battle-tested security libraries
- ✅ Gas-optimized batch TGE activation
- ✅ Single-transaction order taking + deposit
- ✅ Auto-settlement on token deposit

---

## 🛠 Technology Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS
- **Web3**: wagmi v2 + viem + RainbowKit
- **State**: React Hooks + Zustand
- **Deployment**: Netlify

### Smart Contracts
- **Framework**: Foundry
- **Language**: Solidity 0.8.24
- **Libraries**: Solady (Ownable, Pausable, ReentrancyGuard)
- **Network**: Ethereum Sepolia (testnet)
- **Storage**: IPFS via Pinata

---

## 📖 Documentation

### Essential Docs (Root)
- **README.md** (this file) - Overview & quick start
- **V3_MIGRATION_COMPLETE.md** - V3 migration guide & testing
- **FOUNDRY_AUDIT_SUMMARY.md** - Security audit results (Grade: A+)

### Archived Docs
See `docs/archive/` for historical documentation:
- V1/V2 implementation details
- Migration guides
- Old feature specifications
- Development logs

---

## 🔒 Security

**Latest Audit**: October 22, 2025  
**Grade**: A+ ✅

- ✅ No high-severity issues
- ✅ Reentrancy protection (Solady)
- ✅ Access control (Ownable)
- ✅ Pausable emergency controls
- ✅ Comprehensive test coverage

See `FOUNDRY_AUDIT_SUMMARY.md` for full details.

---

## 🧪 Testing

### Run All Tests
```bash
cd contracts
forge test -vvv
```

### Run Specific Test
```bash
forge test --match-test test_FunctionName -vvv
```

### Run Linter
```bash
forge lint
```

### Generate Gas Report
```bash
forge test --gas-report
```

### Run Frontend Tests
```bash
cd frontend
npm test
```

---

## 🚢 Deployment

### Deploy Contracts (Sepolia)
```bash
cd contracts
source .env
forge script script/DeployV3.s.sol --rpc-url sepolia --broadcast --verify
```

### Deploy Frontend (Netlify)
Connected to GitHub `main` branch for automatic deployments.

**Environment Variables Required:**
```
NEXT_PUBLIC_ORDERBOOK=0x...
NEXT_PUBLIC_STABLE=0x...
NEXT_PUBLIC_REGISTRY=0x...
NEXT_PUBLIC_STABLE_DECIMALS=6
NEXT_PUBLIC_RPC=https://ethereum-sepolia-rpc.publicnode.com
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
PINATA_JWT=...
NEXT_PUBLIC_GROK_API_KEY=...
```

---

## 🎯 Core Features

### For Users
- **Create Orders**: List token allocations for sale or post buy offers
- **Browse Markets**: Explore pre-TGE projects (Tokens & Points)
- **Escrow Safety**: Collateral-backed trades with smart contract protection
- **TGE Settlement**: Automatic settlement after token launch
- **Points Trading**: Off-chain proof submission for points projects

### For Admins
- **Project Management**: Add/edit projects via on-chain registry
- **IPFS Integration**: Upload logos/metadata to Pinata
- **TGE Activation**: Batch activate settlement for multiple orders
- **Emergency Controls**: Pause/unpause trading, extend deadlines
- **Analytics**: View orderbook stats and trade volume

---

## 🏗 Development Workflow

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
forge lint

# Frontend
npm run build  # Check for build errors
```

### 3. Commit & Push
```bash
git add .
git commit -m "feat: description of changes"
git push origin main
```

### 4. Deploy
- **Contracts**: Manual deployment via Foundry
- **Frontend**: Automatic via Netlify (on push to main)

---

## 🤝 Contributing

This is a private project. For questions or issues, contact the development team.

---

## 📜 License

Proprietary - All Rights Reserved

---

## 🔗 Links

- **Website**: [otcx.fun](https://otcx.fun)
- **Documentation**: [docs.otcx.fun](https://docs.otcx.fun)
- **GitHub**: Private Repository
- **Network**: Ethereum Sepolia (Testnet)

---

## 📊 Project Stats

- **Smart Contracts**: 2 (V3)
- **Security Grade**: A+
- **Test Coverage**: Comprehensive
- **Frontend**: Next.js 15 + React 19
- **Network**: Sepolia Testnet
- **Status**: Production Ready 🚀
