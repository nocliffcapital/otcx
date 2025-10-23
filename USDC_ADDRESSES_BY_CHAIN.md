# 💰 USDC Addresses by Chain - Complete Reference

**Good catch!** USDC has different addresses on each chain. Here's the complete list:

---

## 🔵 **USDC Native (Circle's Official USDC)**

These chains have **native USDC** issued directly by Circle:

| Chain | USDC Address | Type | Decimals |
|-------|--------------|------|----------|
| **Ethereum** | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | Native | 6 |
| **Arbitrum** | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | Native | 6 |
| **Base** | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Native | 6 |
| **Optimism** | `0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85` | Native | 6 |
| **Polygon** | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` | Native | 6 |
| **Avalanche** | `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` | Native | 6 |

**Note**: Use **Native USDC** when available - it's the official Circle version!

---

## 🧪 **Testnet USDC Addresses**

| Chain | USDC Address | Type |
|-------|--------------|------|
| **Sepolia** | `0xd5d56a9Cd59550c6D95569620F7eb89C1E4c9101` | Mock (Your Deployment) |
| **Arbitrum Sepolia** | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` | Native Testnet |
| **Base Sepolia** | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | Native Testnet |
| **Optimism Sepolia** | `0x5fd84259d66Cd46123540766Be93DFE6D43130D7` | Native Testnet |

---

## ✅ **Your Contract Already Handles This!**

### **No Hardcoded Addresses** ✅

```solidity
// EscrowOrderBookV4.sol - Line 152

constructor(address stableToken, address _feeCollector) {
    // ✅ Stablecoin address passed as parameter
    stable = IERC20(stableToken);
    stableDecimals = IERC20(stableToken).decimals();
    
    // ✅ Automatically approves the deployment stablecoin
    approvedCollateral[stableToken] = true;
    approvedCollateralList.push(stableToken);
}
```

**This means**:
- ✅ Deploy with different USDC address on each chain
- ✅ No code changes needed
- ✅ Works with any 6-decimal stablecoin (USDC, USDT, etc.)

---

## 🚀 **Deployment Example for Each Chain**

### **1. Sepolia (Current)**

```bash
forge script script/DeployV4.s.sol \
  --rpc-url sepolia \
  --broadcast

# Constructor args:
# stableToken: 0xd5d56a9Cd59550c6D95569620F7eb89C1E4c9101 (Your Mock USDC)
# feeCollector: 0x61fEDd6BC4ef1ab11cf8b6CC8F9b4Faeb41B6f55 (Your Address)
```

### **2. Arbitrum Mainnet**

```bash
forge script script/DeployV4.s.sol \
  --rpc-url arbitrum \
  --broadcast

# Constructor args:
# stableToken: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 (USDC Native)
# feeCollector: YOUR_FEE_COLLECTOR_ADDRESS
```

### **3. Base Mainnet**

```bash
forge script script/DeployV4.s.sol \
  --rpc-url base \
  --broadcast

# Constructor args:
# stableToken: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 (USDC Native)
# feeCollector: YOUR_FEE_COLLECTOR_ADDRESS
```

### **4. Optimism Mainnet**

```bash
forge script script/DeployV4.s.sol \
  --rpc-url optimism \
  --broadcast

# Constructor args:
# stableToken: 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85 (USDC Native)
# feeCollector: YOUR_FEE_COLLECTOR_ADDRESS
```

### **5. Polygon Mainnet**

```bash
forge script script/DeployV4.s.sol \
  --rpc-url polygon \
  --broadcast

# Constructor args:
# stableToken: 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359 (USDC Native)
# feeCollector: YOUR_FEE_COLLECTOR_ADDRESS
```

---

## 🛠️ **Updated Deployment Script**

Let me update `DeployV4.s.sol` to use chain-specific USDC:

```solidity
// script/DeployV4.s.sol

contract DeployV4 is Script {
    // Chain-specific USDC addresses
    mapping(uint256 => address) public usdcAddresses;
    
    constructor() {
        // Testnets
        usdcAddresses[11155111] = 0xd5d56a9Cd59550c6D95569620F7eb89C1E4c9101; // Sepolia (Mock)
        usdcAddresses[421614] = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;   // Arbitrum Sepolia
        usdcAddresses[84532] = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;    // Base Sepolia
        
        // Mainnets (Native USDC)
        usdcAddresses[1] = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;       // Ethereum
        usdcAddresses[42161] = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;   // Arbitrum
        usdcAddresses[8453] = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;    // Base
        usdcAddresses[10] = 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85;      // Optimism
        usdcAddresses[137] = 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359;     // Polygon
    }
    
    function run() external {
        uint256 chainId = block.chainid;
        address usdc = usdcAddresses[chainId];
        require(usdc != address(0), "USDC not configured for this chain");
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address feeCollector = vm.envAddress("FEE_COLLECTOR");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy with chain-specific USDC
        EscrowOrderBookV4 orderbook = new EscrowOrderBookV4(
            usdc,           // ✅ Chain-specific USDC
            feeCollector
        );
        
        ProjectRegistryV2 registry = new ProjectRegistryV2();
        
        vm.stopBroadcast();
        
        console.log("=== Deployment Complete ===");
        console.log("Chain:", chainId);
        console.log("USDC:", usdc);
        console.log("Orderbook:", address(orderbook));
        console.log("Registry:", address(registry));
    }
}
```

---

## 📊 **USDC Comparison by Chain**

| Chain | USDC Type | Liquidity | Gas Cost | Best For |
|-------|-----------|-----------|----------|----------|
| **Ethereum** | Native | Highest | $5-20 | Large trades |
| **Arbitrum** | Native | Very High | $0.10 | ⭐ Best overall |
| **Base** | Native | High | $0.05 | ⭐ Cheapest |
| **Optimism** | Native | High | $0.10 | Established |
| **Polygon** | Native | Medium | $0.01 | Micro-trades |

All have **6 decimals** ✅ (your contract auto-detects this!)

---

## 🔍 **How to Verify USDC Addresses**

### **Method 1: Circle's Official List**
https://developers.circle.com/stablecoins/docs/usdc-on-main-networks

### **Method 2: Block Explorers**
- Ethereum: https://etherscan.io/token/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
- Arbitrum: https://arbiscan.io/token/0xaf88d065e77c8cC2239327C5EDb3A432268e5831
- Base: https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

### **Method 3: Check in Code**
```bash
# Check USDC decimals
cast call 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 "decimals()(uint8)" --rpc-url arbitrum
# Output: 6 ✅

# Check USDC name
cast call 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 "name()(string)" --rpc-url arbitrum
# Output: "USD Coin" ✅
```

---

## ⚠️ **Important Notes**

### **1. Bridged vs Native USDC**

Some chains had "bridged USDC" before Circle launched native:

| Chain | Old (Bridged) | New (Native) | Use |
|-------|--------------|--------------|-----|
| **Arbitrum** | `0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8` | `0xaf88d065...` | ✅ Use Native |
| **Optimism** | `0x7F5c764cBc14f9669B88837ca1490cCa17c31607` | `0x0b2C639c...` | ✅ Use Native |
| **Base** | N/A (Native from launch) | `0x833589fC...` | ✅ Use Native |
| **Polygon** | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` | `0x3c499c54...` | ✅ Use Native |

**Always use Native USDC!** It's the official Circle version.

### **2. Decimal Differences**

Some old bridged USDC had different decimals:
- Native USDC: **6 decimals** ✅
- Old bridged: Sometimes 6, sometimes 18

**Your contract handles this automatically**:
```solidity
stableDecimals = IERC20(stableToken).decimals(); // ✅ Auto-detects!
```

### **3. Frontend Must Match**

Update your frontend config when deploying:

```typescript
// frontend/src/lib/chains.ts

arbitrum: {
  id: 42161,
  orderbook: '0xYOUR_DEPLOYED_ORDERBOOK',
  stable: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // ✅ Arbitrum USDC
  stableDecimals: 6,
},

base: {
  id: 8453,
  orderbook: '0xYOUR_DEPLOYED_ORDERBOOK',
  stable: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // ✅ Base USDC
  stableDecimals: 6,
},
```

---

## 🎯 **Summary**

### **Your Contract = Perfect for Multichain** ✅

```solidity
// ✅ Stablecoin is a constructor parameter (not hardcoded)
constructor(address stableToken, address _feeCollector)

// ✅ Decimals are auto-detected
stableDecimals = IERC20(stableToken).decimals();

// ✅ Works with any 6-decimal stablecoin
// ✅ No code changes needed per chain
```

### **Deployment Steps:**

1. Get chain-specific USDC address from table above
2. Deploy: `new EscrowOrderBookV4(USDC_ADDRESS, FEE_COLLECTOR)`
3. Update frontend config with new addresses
4. Done! ✅

### **Key Takeaway:**

**Each chain gets its own deployment with that chain's USDC address.** The contract doesn't care - it just takes whatever ERC20 you pass in the constructor!

---

## 📚 **References**

- Circle USDC Docs: https://developers.circle.com/stablecoins/docs
- USDC on Arbitrum: https://portal.arbitrum.io/native-usdc
- USDC on Base: https://docs.base.org/guides/bridge-usdc
- USDC on Optimism: https://community.optimism.io/docs/guides/bridge-usdc

**Your contract design is already multichain-ready!** 🚀

