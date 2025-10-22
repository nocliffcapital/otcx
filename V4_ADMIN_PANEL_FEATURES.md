# V4 Admin Panel Features

**Last Updated:** October 22, 2025  
**Version:** V4 with Fee Management & Collateral Whitelist

---

## 🎯 Overview

The V4 admin panel now includes **two major new sections** to manage protocol fees and collateral whitelisting. These features give you full control over the economic parameters and security of your orderbook.

---

## 💰 Fee Configuration Panel

### What It Does
Allows the contract owner to view and update protocol fees for settlements and cancellations.

### Features

#### View Current Fees
- **Settlement Fee**: Displayed as both percentage (0.5%) and BPS (50)
- **Cancellation Fee**: Displayed as both percentage (0.1%) and BPS (10)
- **Maximum Fee Cap**: Shows the hard limit (5% / 500 BPS)
- **Fee Collector**: Displays the wallet address receiving protocol fees

#### Update Fees
1. Click "Manage Fees" to expand the update section
2. Enter new fee in BPS (Basis Points)
   - Example: 50 BPS = 0.5%
   - Range: 0-500 BPS (0-5%)
3. Click "Update" button
4. Confirm the transaction
5. Fees update immediately for future orders

### UI Elements
- **Color Theme**: Cyan (bright blue)
- **Icon**: Dollar Sign ($)
- **Layout**: 3-column grid for fee display
- **Collapsible**: Yes, hide/show update form

### How Fees Work

#### Settlement Fee (Default: 0.5%)
- Applied when an order is settled after TGE
- Deducted from **both** sides:
  - Buyer pays 0.5% in project tokens
  - Seller pays 0.5% in stablecoins (USDC)
- Fee automatically transferred to fee collector
- Cannot be changed retroactively (only affects new settlements)

#### Cancellation Fee (Default: 0.1%)
- Applied when an order is cancelled
- Deducted from maker's collateral
- Immediate effect (no grace period in V4)
- Discourages frivolous order creation
- Compensates for gas costs

### Testing Checklist
- [ ] View current fees (should show 0.5% and 0.1%)
- [ ] Update settlement fee to 1% (100 BPS)
- [ ] Verify confirmation dialog appears
- [ ] Check transaction on Etherscan
- [ ] Confirm fee updated on refresh
- [ ] Try updating cancellation fee to 0.2% (20 BPS)
- [ ] Test with invalid values (e.g., 600 BPS) - should reject
- [ ] Verify fee collector address is correct

---

## 🛡️ Collateral Whitelist Manager

### What It Does
Manages which ERC20 tokens can be used as collateral for orders. This prevents malicious or fake tokens from being used.

### Features

#### View Approved Tokens
- Lists all whitelisted collateral tokens
- Shows token addresses in monospace font
- Indicates primary stable (cannot be removed)
- Displays total count

#### Current Whitelist
1. **USDC** - Primary stable (auto-approved, cannot remove)
2. **USDT** - Secondary stable (manually approved, can remove)

#### Add New Collateral
1. Click "Manage Collateral" to expand
2. Enter ERC20 token address
3. Click "Approve" button
4. Confirm transaction
5. Token added to whitelist immediately

#### Remove Collateral
1. Find token in the list
2. Click "Remove" button (only available for non-primary tokens)
3. Confirm removal
4. Token removed from whitelist
5. **Note**: Existing orders with that collateral are unaffected

### UI Elements
- **Color Theme**: Violet (purple)
- **Icon**: Shield
- **Layout**: Vertical list with remove buttons
- **Collapsible**: Yes, hide/show add form

### Security Features

#### Protection Mechanisms
- ✅ Cannot remove primary stable (USDC)
- ✅ Address validation before approval
- ✅ ERC20 code verification (contract-side)
- ✅ Confirmation dialogs for all changes
- ✅ Warning messages about trusted tokens only

#### Why Whitelist?
1. **Security**: Prevents fake/malicious tokens
2. **Liquidity**: Ensures liquid, tradable assets
3. **Trust**: Only established stablecoins approved
4. **Gas Efficiency**: Limits token types for simpler code
5. **Risk Management**: Admin controls acceptable collateral

### Testing Checklist
- [ ] View current whitelist (USDC + USDT)
- [ ] Try to remove USDC (should fail/warn)
- [ ] Remove USDT successfully
- [ ] Add USDT back to whitelist
- [ ] Try adding invalid address (should reject)
- [ ] Try adding non-ERC20 address (contract should revert)
- [ ] Verify existing orders unaffected by removals
- [ ] Check events on Etherscan (CollateralApproved/Removed)

---

## 📊 Admin Panel Layout

### Section Order (Top to Bottom)

1. **Emergency Controls** (Red/Green)
   - Pause/unpause orderbook
   - Critical safety feature
   - Existing functionality

2. **Fee Configuration** 💰 (Cyan) **[NEW]**
   - View and update settlement fees
   - View and update cancellation fees
   - Monitor fee collector

3. **Collateral Whitelist** 🛡️ (Violet) **[NEW]**
   - View approved tokens
   - Add new collateral
   - Remove unsafe tokens

4. **Add/Edit Projects** (Blue)
   - Create new projects
   - Update metadata
   - Set token addresses
   - Existing functionality

5. **Projects List** (Default)
   - View all projects
   - Edit project details
   - Toggle active status
   - Existing functionality

6. **TGE Settlement Manager** (Orange)
   - Activate project TGE
   - Manage settlement windows
   - Existing functionality (updated for V4)

---

## 🎨 Design Principles

### Color Coding
- **Red/Green**: Emergency controls (pause state)
- **Cyan**: Fee management (financial)
- **Violet**: Security features (whitelist)
- **Blue**: Project management
- **Orange**: TGE operations

### Icons
- `DollarSign`: Fees and payments
- `Shield`: Security and protection
- `Coins`: Token/collateral
- `Trash2`: Removal actions
- `Settings`: Admin/config
- `AlertTriangle`: Warnings

### Interaction Patterns
- **Collapsible Sections**: Reduce visual clutter
- **Confirmation Dialogs**: Prevent accidental changes
- **Loading States**: Show transaction progress
- **Badges**: Highlight important info (primary stable, auto-transfer)
- **Tooltips**: Explain BPS, validation rules

---

## 🔐 Access Control

### Owner-Only Features
All V4 admin features require the connected wallet to be the contract owner:

```solidity
modifier onlyOwner() {
    if (msg.sender != owner()) revert NotAuthorized();
    _;
}
```

### Functions Restricted to Owner
- `setSettlementFee(uint64 newFeeBps)`
- `setCancellationFee(uint64 newFeeBps)`
- `approveCollateral(address token)`
- `removeCollateral(address token)`
- `pause()` / `unpause()`
- `setProjectStatus(bytes32 projectId, bool active)`
- `activateProjectTGE(...)`

---

## 💡 Usage Examples

### Example 1: Increase Settlement Fee
**Scenario**: Protocol wants to increase revenue to 1%

1. Navigate to Admin Panel
2. Expand "Fee Configuration"
3. Settlement Fee input: Enter `100` (for 1%)
4. Click "Update"
5. Confirm: "Update settlement fee to 1.00%?"
6. Wait for transaction
7. Refresh page to see new fee

**Result**: All future settlements will charge 1% from each side

---

### Example 2: Add DAI as Collateral
**Scenario**: You want to accept DAI stablecoin

1. Get DAI contract address (e.g., `0x6B17...`)
2. Navigate to Admin Panel
3. Expand "Collateral Whitelist"
4. Click "Manage Collateral"
5. Paste DAI address
6. Click "Approve"
7. Confirm transaction
8. DAI appears in whitelist

**Result**: Users can now create orders with DAI collateral

---

### Example 3: Remove Deprecated Token
**Scenario**: USDT is compromised, need to remove it

1. Navigate to Admin Panel
2. Find USDT in collateral list
3. Click "Remove" button
4. Confirm: "Remove 0x950D... from approved collateral? Existing orders will not be affected."
5. Wait for transaction
6. USDT removed from list

**Result**: New orders cannot use USDT, but existing USDT orders still function

---

## 🧪 Testing Scenarios

### Fee Configuration Tests

#### Test 1: Valid Fee Update
```
Input:  50 BPS (settlement)
Result: ✅ Fee updated to 0.5%
Check:  settlementFeeBps() == 50
```

#### Test 2: Maximum Fee Update
```
Input:  500 BPS
Result: ✅ Fee updated to 5% (max allowed)
Check:  settlementFeeBps() == 500
```

#### Test 3: Excessive Fee (Should Fail)
```
Input:  600 BPS
Result: ❌ Alert: "Fee must be between 0 and 5.00%"
Check:  Transaction not sent
```

#### Test 4: Zero Fee
```
Input:  0 BPS
Result: ✅ Fee updated to 0% (no fees)
Check:  settlementFeeBps() == 0
```

---

### Collateral Whitelist Tests

#### Test 1: Add Valid ERC20
```
Input:  0x123... (valid ERC20 with code)
Result: ✅ Token added to whitelist
Check:  approvedCollateral[0x123...] == true
```

#### Test 2: Add Already Approved Token
```
Input:  0x6B40... (USDC - already approved)
Result: ❌ Contract reverts: CollateralAlreadyApproved()
Check:  No state change
```

#### Test 3: Remove Primary Stable
```
Input:  0x6B40... (USDC - primary)
Result: ❌ Contract reverts: InvalidAddress() (can't remove stable)
Check:  USDC still in whitelist
```

#### Test 4: Remove Secondary Token
```
Input:  0x950D... (USDT)
Result: ✅ Token removed from whitelist
Check:  approvedCollateral[0x950D...] == false
```

#### Test 5: Add Invalid Address
```
Input:  0x123 (too short)
Result: ❌ Alert: "Invalid token address"
Check:  Transaction not sent
```

---

## 📝 Best Practices

### Fee Management
1. **Start Conservative**: Begin with low fees (0.1-0.5%)
2. **Monitor Usage**: Track order volume before increasing
3. **Communicate Changes**: Announce fee updates to users
4. **Test on Testnet**: Always test fee changes on Sepolia first
5. **Consider Markets**: Higher fees during high volatility

### Collateral Management
1. **Vet Tokens**: Only approve established, liquid tokens
2. **Check Decimals**: Verify token has 18 decimals (enforced for project tokens)
3. **Monitor Exploits**: Remove tokens if security issues arise
4. **Gradual Rollout**: Add one token at a time, monitor
5. **Keep USDC**: Never remove primary stable

### Security
1. **Use Multisig**: Consider Gnosis Safe for owner role
2. **Time Locks**: Add delays for critical parameter changes
3. **Emergency Pause**: Use pause feature if issues detected
4. **Monitor Events**: Set up alerts for fee/collateral changes
5. **Audit Changes**: Review all transactions on Etherscan

---

## 🔗 Related Documentation

- [V4 Integration Complete](./V4_INTEGRATION_COMPLETE.md) - Full V4 summary
- [V4 Testing Guide](./V4_TESTING_GUIDE.md) - Complete test scenarios
- [V4 Security Audit](./V4_SECURITY_AUDIT.md) - Security review
- [V4 Sepolia Deployment](./V4_SEPOLIA_DEPLOYMENT.md) - Contract addresses

---

## 🎯 Quick Reference

### Fee BPS to Percentage
| BPS | Percentage | Use Case |
|-----|------------|----------|
| 10 | 0.1% | Low cancellation fee |
| 25 | 0.25% | Moderate fee |
| 50 | 0.5% | Default settlement fee (V4) |
| 100 | 1.0% | Higher revenue |
| 200 | 2.0% | Premium service |
| 500 | 5.0% | Maximum allowed |

### Approved Collateral (Sepolia)
| Token | Address | Decimals | Can Remove? |
|-------|---------|----------|-------------|
| USDC | `0x6B40...` | 6 | ❌ No (primary) |
| USDT | `0x950D...` | 6 | ✅ Yes |

### Contract Functions
```solidity
// Fee Management
setSettlementFee(uint64 newFeeBps)      // Update settlement fee
setCancellationFee(uint64 newFeeBps)    // Update cancellation fee

// Collateral Management
approveCollateral(address token)        // Add to whitelist
removeCollateral(address token)         // Remove from whitelist
getApprovedCollateral() returns (address[]) // View whitelist
```

---

**Your V4 admin panel is fully equipped to manage fees and collateral!** 🎉


