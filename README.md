# otcX - Decentralized OTC Desk

A production-grade decentralized OTC marketplace for pre-TGE tokens and points with on-chain escrow (Model A).

## Features

- ✅ **On-Chain Escrow**: Buyer and seller both lock collateral in smart contracts
- ✅ **Model A Architecture**: Full price locked by buyer, equal collateral by seller
- ✅ **Default Protection**: If either party fails, counterparty receives compensation
- ✅ **On-Chain Project Registry**: Fully decentralized project listing
- ✅ **Sepolia Testnet**: Deployed and ready to test
- ✅ **Real-Time Order Book**: View and interact with live orders
- ✅ **Comprehensive UI**: Create, take, cancel, and fill orders

## Architecture

### Smart Contracts (Foundry)
- **EscrowOrderBook.sol**: Main orderbook contract with escrow logic
- **ProjectRegistry.sol**: On-chain registry for projects (slug, name, token address, asset type)
- **MockUSDC.sol**: Test stablecoin (6 decimals) for Sepolia
- Security: ReentrancyGuard, Pausable, Ownable
- Tested: 100% test coverage with Foundry

### Frontend (Next.js)
- **Next.js 14** with App Router and TypeScript
- **wagmi + viem**: Ethereum interactions
- **RainbowKit**: Wallet connection
- **TailwindCSS**: Modern dark-themed UI

## Deployed Contracts (Sepolia)

- **MockUSDC**: `0x76fBfc7cE378668DB249850094156338Ee546f83`
- **EscrowOrderBook**: `0x23dFa1e657686DB18D6a598dBdf75797416FDB5A`
- **ProjectRegistry**: `0x5DC0110b057331018693FfCf96983Fd02c91ad0e`

View on Etherscan:
- [MockUSDC](https://sepolia.etherscan.io/address/0x76fBfc7cE378668DB249850094156338Ee546f83)
- [Orderbook](https://sepolia.etherscan.io/address/0x23dFa1e657686DB18D6a598dBdf75797416FDB5A)
- [ProjectRegistry](https://sepolia.etherscan.io/address/0x5DC0110b057331018693FfCf96983Fd02c91ad0e)

## Quick Start

### Prerequisites
- Node.js 18+ and npm/pnpm
- Foundry (for contracts)
- MetaMask or similar wallet
- Sepolia testnet ETH

### 1. Clone and Install

```bash
cd otcx

# Install contract dependencies
cd contracts
forge install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Set Up Environment Variables

#### Contracts (`.env`)
```bash
cd contracts
cp .env.example .env
# Edit .env and add:
SEPOLIA_RPC_URL=your-alchemy-or-infura-url
PRIVATE_KEY=your-test-wallet-private-key
STABLE_ADDRESS=  # Leave empty to deploy MockUSDC
```

#### Frontend (`.env.local`)
```bash
cd frontend
cp .env.example .env.local
# Edit .env.local and add:
NEXT_PUBLIC_RPC=your-alchemy-or-infura-url
NEXT_PUBLIC_ORDERBOOK=0x801167addF658512Ea4bCD2610ef90e30b7E892e
NEXT_PUBLIC_STABLE=0x320B9D98AFce3b12D66fd2351AFaFD15a6ebebA2
NEXT_PUBLIC_STABLE_DECIMALS=6
```

### 3. Get Testnet Assets

1. **Get Sepolia ETH**: Visit [sepoliafaucet.com](https://sepoliafaucet.com)
2. **Mint Test USDC**: Click "Mint 10k Test USDC" button in the UI

### 4. Run the App

```bash
cd frontend
npm run dev
```

Visit http://localhost:3000

## Usage Guide

### Creating Orders

1. Navigate to **Projects** and select a project
2. Choose **Sell** or **Buy**
3. Enter:
   - **Amount**: Number of tokens
   - **Unit Price**: Price per token in USDC
   - **Expiry**: Days until order expires
4. Click **Create Order**
   - Transaction 1: Approve USDC
   - Transaction 2: Create order + deposit collateral

### Taking Orders

1. Browse available orders in the orderbook
2. Click **Take Order** on any order
3. Confirm transaction to lock your collateral

### Completing Trades

1. Once both parties have locked collateral, **Mark Filled** button appears
2. Either party can mark the order as filled
3. Seller receives payment, both get collateral back

### Canceling Orders

1. Go to **My Orders**
2. Click **Cancel** on any order where counterparty hasn't locked collateral yet
3. Your collateral is returned

### Default Scenarios

If counterparty fails to deliver after expiry:
- **Seller defaults**: Buyer gets seller's collateral
- **Buyer defaults**: Seller gets buyer's funds

### Managing Projects (Admin Only)

Projects are stored on-chain in the **ProjectRegistry** contract. The contract owner can:

**Add a new project:**
```bash
# Using cast (Foundry)
cast send $REGISTRY_ADDRESS \
  "addProject(string,string,address,string)" \
  "myproject" "My Project" "0x123..." "Tokens" \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```

**Update an existing project:**
```bash
cast send $REGISTRY_ADDRESS \
  "updateProject(string,string,address,string)" \
  "myproject" "My Project Updated" "0x456..." "Points" \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```

**Disable/Enable a project:**
```bash
# Disable
cast send $REGISTRY_ADDRESS \
  "setProjectStatus(string,bool)" \
  "myproject" false \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY

# Enable
cast send $REGISTRY_ADDRESS \
  "setProjectStatus(string,bool)" \
  "myproject" true \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```

**Read projects:**
```bash
# Get all active projects
cast call $REGISTRY_ADDRESS "getActiveProjects()" --rpc-url $SEPOLIA_RPC_URL

# Get specific project
cast call $REGISTRY_ADDRESS "getProject(string)" "eigen" --rpc-url $SEPOLIA_RPC_URL
```

Note: Initial 6 projects (EigenLayer, Blast, zkSync, Starknet, Scroll, Linea) are added during deployment.

## Development

### Running Tests

```bash
cd contracts
forge test -vvv
```

### Deploying Contracts

```bash
cd contracts
source .env
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```

## Project Structure

```
otcx/
├── contracts/               # Foundry project
│   ├── src/
│   │   ├── EscrowOrderBook.sol
│   │   ├── interfaces/IERC20.sol
│   │   └── mocks/MockUSDC.sol
│   ├── script/Deploy.s.sol
│   ├── test/Orderbook.t.sol
│   └── foundry.toml
└── frontend/                # Next.js app
    ├── src/
    │   ├── app/            # Pages
    │   ├── components/     # UI components
    │   ├── hooks/          # React hooks
    │   └── lib/            # Contracts & config
    └── package.json
```

## Order Flow Details

### Model A: Full Escrow

**Sell Order**:
1. Seller creates order and locks `amount * unitPrice` in USDC
2. Buyer sees order and locks `amount * unitPrice` in USDC
3. After delivery, either party marks filled
4. Seller receives `amount * unitPrice` (payment)
5. Seller receives `amount * unitPrice` (collateral back)

**Buy Order**:
1. Buyer creates order and locks `amount * unitPrice` in USDC
2. Seller sees order and locks `amount * unitPrice` in USDC
3. After delivery, either party marks filled
4. Seller receives `amount * unitPrice` (payment)
5. Seller receives `amount * unitPrice` (collateral back)

## Security

- ✅ ReentrancyGuard on all state-changing functions
- ✅ Checks-effects-interactions pattern
- ✅ Pausable for emergency stops
- ✅ Safe math (Solidity 0.8+)
- ✅ No custody of project tokens (off-chain delivery)
- ✅ Comprehensive test coverage

## Future Enhancements

- [ ] EIP-712 attested fulfillment
- [ ] Multi-stable support
- [ ] Order matching engine
- [ ] Subgraph for efficient querying
- [ ] Reputation system
- [ ] Dispute resolution

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.

