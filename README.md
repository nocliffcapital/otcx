# 🚀 otcX - Pre-TGE OTC Trading Platform

A decentralized OTC marketplace for trading pre-TGE tokens and points with secure escrow settlement.

## ✨ Features

- **Dual Asset Support**: Trade both on-chain Tokens and off-chain Points
- **Secure Escrow**: 1:1 collateral locks from both parties
- **TGE Settlement**: Admin-controlled settlement windows with flexible extensions
- **Good-Til-Cancel Orders**: Orders never expire, stay active until filled or canceled
- **On-Chain Settlement**: Direct token transfers for Token projects
- **Off-Chain Proof**: Proof submission system for Points projects
- **Reputation System**: Track user trading history and reliability
- **AI Market Analysis**: Grok integration for sentiment and price analysis

## 📦 Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Wagmi v2** - React hooks for Ethereum
- **RainbowKit** - Wallet connection
- **Tailwind CSS** - Styling
- **Recharts** - Trading charts

### Smart Contracts
- **Solidity 0.8.24** - Smart contract language
- **Foundry** - Development framework
- **OpenZeppelin** - Security standards

## 🏗️ Architecture

### Smart Contracts (Sepolia Testnet)

```
MockUSDC: 0xd5d56a9Cd59550c6D95569620F7eb89C1E4c9101
OrderBook: 0x192A4A6b2bb16393802Be621D805dAc64C617DBf
Registry: 0x1d35A58D583678E80e25D6D433aE8F9722751A94
```

### Order Flow

1. **Create Order** - Maker creates buy/sell order with project token and price
2. **Lock Collateral** - Both parties lock 100% collateral (seller) and 100% payment (buyer)
3. **TGE Activation** - Admin activates TGE when token launches
4. **Settlement**:
   - **Tokens**: Seller deposits tokens → Buyer claims → Funds released
   - **Points**: Seller submits proof → Admin verifies → Funds released
5. **Complete** - Order settled, funds distributed

## 🚦 Getting Started

### Prerequisites

- Node.js v20+
- Foundry
- MetaMask or compatible wallet

### Installation

```bash
# Clone repository
git clone <your-repo-url>
cd otcx

# Install frontend dependencies
cd frontend
npm install

# Install contract dependencies
cd ../contracts
forge install
```

### Environment Setup

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_STABLE=0xd5d56a9Cd59550c6D95569620F7eb89C1E4c9101
NEXT_PUBLIC_ORDERBOOK=0x192A4A6b2bb16393802Be621D805dAc64C617DBf
NEXT_PUBLIC_REGISTRY=0x1d35A58D583678E80e25D6D433aE8F9722751A94
NEXT_PUBLIC_STABLE_DECIMALS=6
NEXT_PUBLIC_ALCHEMY_KEY=<your-key>
NEXT_PUBLIC_RPC=https://eth-sepolia.g.alchemy.com/v2/<your-key>
GROK_API_KEY=<your-key>
```

### Run Development Server

```bash
cd frontend
npm run dev
```

Visit `http://localhost:3000`

## 📝 Usage

### For Traders

1. **Connect Wallet** - Connect MetaMask to Sepolia testnet
2. **Get Test USDC** - Mint MockUSDC for trading
3. **Browse Projects** - View active projects and their orderbooks
4. **Place Orders** - Create buy/sell orders with your price
5. **Lock Collateral** - Deposit collateral to activate your order
6. **Settle** - Complete settlement after TGE activation

### For Admins

1. **Add Projects** - Register new projects with name, token, and asset type
2. **Activate TGE** - Start settlement window when token launches
3. **Extend Deadlines** - Add 4h or 24h extensions if needed
4. **Verify Proofs** - For Points projects, verify and settle manually
5. **Pause Trading** - Emergency controls if needed

## 🔒 Security Features

- **Reentrancy Protection** - All critical functions protected
- **Access Control** - Strict role-based permissions
- **Pausable** - Admin emergency brake
- **Max Order Limits** - Prevent fat-finger errors
- **Collateral Locks** - 1:1 bilateral collateral
- **Default Protection** - Buyers can default sellers who miss deadlines

## 📊 Contract Functions

### User Functions
- `createSellOrder` / `createBuyOrder` - Create orders
- `depositSellerCollateral` / `depositBuyerFunds` - Lock collateral
- `takeSellOrder` / `takeBuyOrder` - Take existing orders
- `depositTokensForSettlement` - Seller deposits tokens (Token projects)
- `submitProof` - Seller submits proof (Points projects)
- `claimTokens` - Buyer claims after settlement
- `defaultSeller` - Buyer defaults seller if overdue
- `cancel` - Cancel unfunded orders

### Admin Functions
- `activateTGE` / `batchActivateTGE` - Start settlement
- `extendSettlement` - Extend deadlines
- `manualSettle` - Settle Points orders
- `pause` / `unpause` - Emergency controls

## 🧪 Testing

```bash
# Run contract tests
cd contracts
forge test

# Run with gas reports
forge test --gas-report
```

## 📦 Deployment

### Deploy to Vercel

```bash
cd frontend
vercel --prod
```

Add environment variables in Vercel dashboard.

### Deploy Contracts

```bash
cd contracts
forge script script/DeployFreshRegistry.s.sol --rpc-url sepolia --broadcast --verify
```

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

## 📄 License

MIT License

## 🔗 Links

- **Website**: [otcx.fun](https://otcx.fun)
- **Sepolia Etherscan**: [View Contracts](https://sepolia.etherscan.io/)

---

Built with ❤️ for the pre-TGE trading community
