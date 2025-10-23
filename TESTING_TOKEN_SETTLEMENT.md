# Testing Token Settlement Guide

## Mock Token Deployed ✅

A new **MockToken** contract has been deployed for testing Token settlements:

```
Contract: MockToken (mMEGAETH - Mock MegaETH Token)
Address: 0xfd61aE399C5F9A2e90292395A37F9C87b5f08084
Network: Sepolia
Decimals: 18
Symbol: mMEGAETH
```

## How to Test Token Settlement

### Step 1: Mint Test Tokens
1. Connect your wallet to the app
2. Click the **"Mint mMEGAETH"** button in the navbar (blue button)
3. This will mint **10,000 mMEGAETH tokens** to your wallet
4. You can mint multiple times if needed

### Step 2: Activate TGE for MegaETH
1. Go to the **Admin page** (`/admin`)
2. Find the **MegaETH** project
3. Click the **🚀 TGE** button
4. In the TGE activation modal:
   - **Option 1 (On-chain)**: Enter the token address
     ```
     Token Address: 0xfd61aE399C5F9A2e90292395A37F9C87b5f08084
     ```
   - **Conversion Ratio**: Leave as `1.0` (1:1 ratio for token projects)
   - **Settlement Window**: Set your desired window (e.g., 7 days)
5. Click **Activate TGE**

### Step 3: Test Settlement
1. Go to the **MegaETH market page**
2. You should see orders that are now "In Settlement"
3. Go to your **Dashboard** → **In Settlement** tab
4. For your orders, you should see settlement controls:
   - **Buyer**: "Approve Tokens" → "Deposit Tokens" → Automatic settlement
   - **Seller**: Can default if buyer doesn't deliver

### Step 4: Complete Settlement (Buyer)
1. Click **"Approve Tokens"** - This approves the escrow contract to spend your mMEGAETH
2. Click **"Deposit Tokens"** - This transfers the tokens to the escrow contract
3. The order will automatically settle and USDC will be released to both parties

## Key Features

### MockToken Contract
- **Public Mint Function**: Anyone can mint tokens for testing
- **Standard ERC20**: Fully compatible with the settlement system
- **18 Decimals**: Standard token decimals
- **Verified on Sepolia**: You can view it on Etherscan

### Frontend Integration
- **Navbar Button**: Easy access to mint tokens
- **Config**: Token address is in `frontend/src/lib/contracts.ts`
- **Hover Tooltip**: Button explains what it does

### Settlement Flow
1. **Conversion Ratio**: For token projects, always 1:1 (`1e18`)
2. **Token Amount**: Calculated as `orderAmount * conversionRatio / 1e18`
3. **Automatic Settlement**: When tokens are deposited, order settles immediately
4. **Fee Distribution**: 0.5% fee goes to fee collector from both parties

## Troubleshooting

### "Insufficient Balance" Error
- Mint more mMEGAETH tokens using the navbar button
- Check your balance on Sepolia Etherscan

### "Approval Failed"
- Make sure you approved the correct amount
- Try approving a larger amount (contract will only use what's needed)

### "Settlement Failed"
- Ensure TGE is activated with the correct token address
- Check that the settlement window hasn't expired
- Verify you have enough tokens in your wallet

## Contract Details

### MockToken.sol
```solidity
// Simple mintable ERC20 for testing
contract MockToken is ERC20 {
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
```

### Deployment
```bash
# Deployed using Forge
forge script script/DeployMockToken.s.sol:DeployMockToken \
  --rpc-url sepolia \
  --broadcast \
  --verify
```

### Verification
- Contract is verified on Sourcify
- View on Sepolia Etherscan: https://sepolia.etherscan.io/address/0xfd61aE399C5F9A2e90292395A37F9C87b5f08084

---

**Happy Testing! 🚀**

If you need more tokens or encounter any issues, you can always mint more using the navbar button!

