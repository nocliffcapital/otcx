# otcX Smart Contracts - Audit Package

## Overview
Decentralized OTC marketplace for pre-TGE tokens and points with on-chain escrow settlement.

## Deployed Contracts (Sepolia Testnet)
- **EscrowOrderBookV2**: `0x192A4A6b2bb16393802Be621D805dAc64C617DBf`
- **ProjectRegistry**: `0x19f6a70a9d31Edf5DC24b7C7f8F9B3da86fe6EEd`
- **MockUSDC (Stablecoin)**: `0xd5d56a9Cd59550c6D95569620F7eb89C1E4c9101`

## Contracts for Audit

### 1. EscrowOrderBookV2.sol (PRIMARY)
**Main orderbook contract with TGE settlement mechanism**

Key features:
- Dual collateral escrow (both parties lock funds)
- Good-Til-Cancel (GTC) orders
- TGE activation for settlement windows
- On-chain settlement for tokens
- Off-chain settlement for points (with proof submission)
- Default protection mechanisms
- Emergency pause functionality

Critical functions to review:
- `createSellOrder` / `createBuyOrder` - Order creation
- `takeSellOrder` / `takeBuyOrder` - Order matching
- `activateTGE` / `batchActivateTGE` - TGE activation
- `depositTokensForSettlement` - Token deposit after TGE
- `claimTokens` - Buyer claims tokens
- `submitProof` - Seller submits off-chain proof (Points projects)
- `manualSettle` - Admin settlement for Points projects
- `defaultSeller` / `defaultBuyer` - Default handling

### 2. ProjectRegistry.sol
**Project management and metadata storage**

Key features:
- On-chain project registry (name, token address, Twitter, website, etc.)
- Asset type tracking (Tokens vs Points)
- Active/inactive project status
- Owner-only modifications

Critical functions:
- `addProject` - Register new project
- `updateProject` - Update project metadata
- `setProjectStatus` - Enable/disable projects

### 3. Supporting Files
- `interfaces/IERC20.sol` - Standard ERC20 interface
- `mocks/MockUSDC.sol` - Test stablecoin for development

## Security Concerns to Review

### High Priority
1. **Collateral Safety**: Ensure locked funds are secure and can only be released correctly
2. **Default Mechanisms**: Verify default scenarios don't allow theft
3. **TGE Settlement**: Check settlement window logic and edge cases
4. **Access Control**: Verify owner/admin functions are properly restricted
5. **Reentrancy**: Check all external calls and state changes
6. **Integer Overflow/Underflow**: Review all arithmetic operations
7. **Points Settlement**: Verify off-chain proof mechanism is secure

### Medium Priority
8. **Pause Functionality**: Ensure emergency pause works correctly
9. **Order Cancellation**: Verify orders can only be cancelled before matching
10. **Price Calculation**: Check decimal handling (18 for tokens, 6 for USDC)

## Testing
Run tests with Foundry:
```bash
cd contracts
forge test -vvv
```

## Build
```bash
forge build
```

## Questions?
Contact: [Your contact info]

Repository: https://github.com/nocliffcapital/otcx
Frontend: https://otcx.fun

