# 🧪 Testing Checklist - Registry V2 & OrderBook V4 Integration

**Date**: Ready for testing  
**Environment**: Localhost:3000  
**Network**: Sepolia Testnet

---

## 📋 **New Contract Addresses (Sepolia)**

| Contract | Address | Status |
|----------|---------|--------|
| **Registry V2** | `0xC62C6A9f7dC9BaE298e93D3e5301065578a2343c` | ✅ With improvements |
| **OrderBook V4** | `0xcb1ea97EB6Dd7106c9A3686E2f94c62d01cF37e2` | ✅ With Registry integration |
| **Stablecoin (USDC)** | `0xd5d56a9Cd59550c6D95569620F7eb89C1E4c9101` | Mock USDC |

---

## 🆕 **Registry V2 Improvements**

### **1. Active Project Index (Performance)**
- ✅ `getActiveProjects()` now O(1) instead of O(N)
- ✅ New function: `getActiveProjectCount()`
- ✅ Auto-maintained when project status changes

### **2. Token Address Validation**
- ✅ Points projects must have `address(0)` initially
- ✅ Token projects validate deployed contracts
- ✅ Prevents invalid states at creation

### **3. Integration Functions**
New view functions for better integration:
- ✅ `isActive(bytes32 projectId)` - Check if project is active
- ✅ `getTokenAddress(bytes32 projectId)` - Get token address
- ✅ `isPointsProject(bytes32 projectId)` - Check if Points or Token
- ✅ `exists(bytes32 projectId)` - Check if project exists

### **4. Update Token Address**
- ✅ `updateTokenAddress(bytes32 id, address newTokenAddress)`
- ✅ For Points projects that convert to on-chain tokens
- ✅ Can only update if current address is 0x0 OR project is Points type

### **5. Metadata Validation**
- ✅ Length checks on metadata URIs (1-256 characters)
- ✅ Applied in `addProject()` and `updateMetadata()`

---

## 🔗 **OrderBook V4 + Registry Integration**

### **Project Status Validation**
- ✅ `createOrder()` now calls `registry.isActive(projectId)`
- ✅ Fails immediately with `InvalidProject` error if project is inactive
- ✅ Saves users gas on invalid orders

---

## 🎯 **Frontend Updates**

### **Admin Panel (`/admin`)**

#### **1. Project Fetching**
- ✅ Uses `getAllProjectIds()` to fetch all projects (active + inactive)
- ✅ Shows both active and inactive projects in admin view
- ✅ Filters work correctly (Active, Ended, All)

#### **2. Update Token Address Feature** ⭐ NEW
- ✅ Shows "Add Token" / "Update" button for Points projects
- ✅ Validates address format
- ✅ Calls `updateTokenAddress()` on Registry contract
- ✅ Use case: Points project converts to on-chain token

#### **3. All Admin Functions Connected**
- ✅ Add Project
- ✅ Edit Project
- ✅ Update Metadata
- ✅ Toggle Project Status (active/inactive)
- ✅ Update Token Address (new)
- ✅ TGE Management
- ✅ Fee Management (settlement, cancellation)
- ✅ Collateral Management (approve, remove)
- ✅ Pause/Unpause OrderBook

### **Home Page (`/`)**
- ✅ Uses `getActiveProjects()` to show only active projects
- ✅ Updated comments to reflect V4 behavior
- ✅ Performance improved (O(1) fetch)

### **Docs Page (`/docs`)**
- ✅ All contract addresses dynamically fetched
- ✅ Registry owner displayed
- ✅ Stablecoin address shown
- ✅ Fees dynamically fetched from contract
- ✅ GitHub link corrected to `nocliffcapital/otcx`

---

## ✅ **Test Plan for Tomorrow**

### **1. Admin Panel - Project Management**

#### **Add New Project**
- [ ] Add a Token project with deployed token address
- [ ] Add a Token project without token address (pre-TGE)
- [ ] Add a Points project (should not allow token address)
- [ ] Verify metadata uploads to IPFS correctly
- [ ] Verify project appears in list

#### **Edit Project**
- [ ] Edit project name
- [ ] Edit project metadata
- [ ] Verify changes persist after refresh

#### **Update Token Address** ⭐ NEW FEATURE
- [ ] Create a Points project
- [ ] Click "Add Token" button in Token Address column
- [ ] Enter a valid token address
- [ ] Verify transaction succeeds
- [ ] Verify address is displayed in table
- [ ] Test updating the address again (should work)

#### **Toggle Project Status**
- [ ] Toggle project to inactive
- [ ] Verify project disappears from home page
- [ ] Verify project still shows in admin "All Projects"
- [ ] Try creating an order on inactive project → should fail with "InvalidProject"
- [ ] Toggle project back to active
- [ ] Verify project reappears on home page
- [ ] Verify can create orders again

### **2. Order Creation - Registry Integration**

#### **Valid Project**
- [ ] Create order on active project → should work
- [ ] Verify order appears in dashboard

#### **Invalid Project** ⭐ NEW VALIDATION
- [ ] Set project to inactive in admin
- [ ] Try creating order → should fail with error message
- [ ] Verify user didn't lose gas (early revert)

### **3. TGE Management**

#### **Token Project**
- [ ] Activate TGE with real token address
- [ ] Verify sellers can deposit tokens via `settleOrder()`
- [ ] Verify settlement works

#### **Points Project**
- [ ] Activate TGE with `POINTS_SENTINEL`
- [ ] Verify sellers can submit proofs
- [ ] Admin can accept/reject proofs
- [ ] Permissionless settlement after acceptance
- [ ] Cannot cancel order after proof accepted

#### **Points → Token Conversion** ⭐ NEW USE CASE
- [ ] Create Points project
- [ ] Create and fill orders
- [ ] Before TGE: Update token address via admin
- [ ] Activate TGE with real token address
- [ ] Verify settlement uses token-based flow (not proofs)

### **4. Fee Management**
- [ ] Update settlement fee
- [ ] Verify new fee displayed immediately
- [ ] Update cancellation fee
- [ ] Verify new fee displayed immediately
- [ ] Verify fees show correctly in `/docs`

### **5. Collateral Management**
- [ ] View approved collateral list
- [ ] Approve new collateral address
- [ ] Remove collateral address
- [ ] Verify changes persist

### **6. OrderBook Pause**
- [ ] Pause orderbook
- [ ] Verify cannot create orders
- [ ] Verify can still cancel/settle existing orders
- [ ] Unpause orderbook
- [ ] Verify can create orders again

### **7. Home Page**
- [ ] Verify only active projects shown
- [ ] Verify inactive projects hidden
- [ ] Verify project stats calculate correctly
- [ ] Verify search works
- [ ] Verify filters work (Tokens/Points)
- [ ] Verify sorting works

### **8. Docs Page**
- [ ] Verify Registry address shown
- [ ] Verify OrderBook address shown
- [ ] Verify Stablecoin address shown
- [ ] Verify Registry Owner shown
- [ ] Verify Settlement Fee dynamically updates
- [ ] Verify Cancellation Fee dynamically updates
- [ ] Verify GitHub link correct

---

## 🐛 **Known Behaviors**

### **Registry Owner**
- Admin functions only work if connected wallet is Registry owner
- Owner address: `0x61fEDd6BC4ef1ab11cf8b6CC8F9b4Faeb41B6f55`

### **Points Projects**
- Cannot have token address initially
- Can add token address later via "Update Token Address"
- Settlement method determined by `activateProjectTGE()` token address

### **Token Projects**
- Can have address(0) initially (pre-TGE)
- Can have deployed token address if known
- Must use on-chain settlement (`settleOrder()`)

### **Project Status**
- Active = visible to users, can create orders
- Inactive = hidden from users, cannot create orders
- Admin always sees all projects

---

## 🔒 **Security Features Active**

All critical security fixes are deployed:

1. ✅ **Points-only manual settlement** - Cannot use `settleOrderManual()` on Token projects
2. ✅ **Cancel lockout after proof acceptance** - Cannot cancel after admin accepts proof
3. ✅ **No deadline extension after expiry** - Cannot extend past deadline
4. ✅ **Balance-delta checks** - Protection against fee-on-transfer tokens
5. ✅ **Reentrancy guards** - CEI pattern enforced
6. ✅ **Registry validation** - Cannot create orders on inactive projects

---

## 📝 **Testing Notes**

Record any issues found during testing:

```
Issue 1:
- Description: 
- Steps to reproduce:
- Expected behavior:
- Actual behavior:

Issue 2:
- Description:
- Steps to reproduce:
- Expected behavior:
- Actual behavior:
```

---

## 🚀 **Ready for Production?**

After completing all tests, check:

- [ ] All admin functions work correctly
- [ ] Registry validation prevents invalid orders
- [ ] Update Token Address feature works
- [ ] TGE management works for both Tokens and Points
- [ ] Fee management works
- [ ] Pause/Unpause works
- [ ] No console errors
- [ ] All security features verified
- [ ] Performance is acceptable

---

**Status**: ✅ All updates deployed and ready for testing on `localhost:3000`

