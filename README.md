# otcX - Pre-TGE OTC Trading Platform

**Live Site**: [otcx.fun](https://otcx.fun)

A decentralized platform for trading token allocations before Token Generation Events (TGE), supporting both on-chain tokens and off-chain points systems.

---

## Quick Start

### Frontend Development
```bash
cd frontend

# Copy environment template and fill in values
cp env.example.txt .env.local

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:3000`

**⚠️ Important**: You MUST set up `.env.local` with contract addresses before running the app.

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

#### Security & Protection
- ✅ **100% Collateral Escrow**: Both parties lock full collateral before trading
- ✅ **Reentrancy Protection**: All functions protected with Solady ReentrancyGuard
- ✅ **Fee-on-Transfer Detection**: Balance-delta checks prevent malicious tokens
- ✅ **Safe Transfer Library**: Robust handling of non-standard ERC20 tokens
- ✅ **Access Control**: Self-take prevention, authorization checks

#### Order Management
- **Public & Private Orders**: Create public orders or restrict to specific counterparties
- **Buy & Sell Orders**: Support both maker-buy and maker-sell orders
- **Order Limits**: $100 minimum, $1M maximum per order
- **Order States**: OPEN → FUNDED → SETTLED (with CANCELED/DEFAULTED paths)

#### Settlement System
- **Token Projects**: Permissionless on-chain settlement (anyone can trigger)
- **Points Projects**: Off-chain proof submission with admin verification
- **Settlement Window**: Configurable deadline (default 4 hours, max 7 days)
- **Conversion Ratios**: Points-to-token conversion with grace period corrections
- **Deadline Enforcement**: Proofs must be submitted before deadline

#### Fee Structure
- **Settlement Fee**: 0.5% (split: 0.5% stable + 0.5% token for token projects)
- **Cancellation Fee**: 0.1% (charged to order maker)
- **Fee Limits**: Configurable 0-5% maximum (owner controlled)
- **Fee Collection**: Automatic fee capture on settlement/cancellation

#### Project Types
- **Token Projects**: On-chain ERC20 tokens (18 decimals required)
- **Points Projects**: Off-chain points with on-chain proof verification

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

#### Order Creation & Management
- **Create Orders**: List token allocations for sale or post buy offers
- **Browse Markets**: Explore pre-TGE projects (Tokens & Points)
- **Private Orders**: Share custom order links with specific counterparties
- **Order Cancellation**: Cancel orders with 0.1% fee (before proof acceptance)

#### Trading & Settlement
- **100% Collateral**: Both parties lock full collateral before trading
- **Token Projects**: Automatic on-chain settlement (permissionless)
- **Points Projects**: Submit proof, wait for admin verification, then settle
- **Settlement Window**: 4-hour window after TGE activation (configurable)
- **Default Handling**: Automatic buyer compensation if seller defaults

#### Security Features
- **Proof Submission Deadline**: Prevents griefing attacks
- **Early Settlement Prevention**: Enforces protocol timing guarantees
- **Fee-on-Transfer Protection**: Automatic detection and rejection

### For Admins

#### Project Management
- **Project Registration**: Add/edit projects via on-chain registry
- **IPFS Integration**: Upload logos/metadata to Pinata
- **TGE Activation**: Activate settlement for entire projects (not per-order)
- **Conversion Ratio**: Set points-to-token ratios with 1-hour grace period

#### System Configuration
- **Fee Management**: Adjust settlement (0-5%) and cancellation (0-5%) fees
- **Order Limits**: Set minimum order value ($100 default)
- **Settlement Windows**: Configure deadline (4 hours to 7 days)
- **Emergency Controls**: Pause/unpause trading

#### Points Project Verification
- **Proof Review**: Accept/reject seller proofs after deadline
- **Batch Operations**: Accept multiple proofs in single transaction
- **Proof Deadlines**: Only accept proofs after settlement deadline

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

**⚠️ Required Environment Variables (NO HARDCODED FALLBACKS):**
```bash
# Contract Addresses (REQUIRED)
NEXT_PUBLIC_ORDERBOOK=0x1560B643159F2184B9b416D822fAc1A05769af2F
NEXT_PUBLIC_REGISTRY=0x7fdBE0DEA92E1e246276DCb50c6d7Dc910563D22
NEXT_PUBLIC_STABLE=0xd5d56a9Cd59550c6D95569620F7eb89C1E4c9101
NEXT_PUBLIC_STABLE_DECIMALS=6

# Optional
NEXT_PUBLIC_MOCK_TOKEN=0xfd61aE399C5F9A2e90292395A37F9C87b5f08084

# Pinata (REQUIRED for IPFS)
PINATA_JWT=your_jwt_here
PINATA_GATEWAY=your_gateway_url_here

# Ethos (OPTIONAL - for reputation)
NEXT_PUBLIC_ETHOS_API_KEY=your_api_key_here
```

**Note**: All contract addresses are now pulled from environment variables with NO hardcoded fallbacks. The app will throw an error if these are not set.

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
