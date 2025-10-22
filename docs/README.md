# otcX Documentation

## 📚 Current Documentation (Root Level)

Essential documents for V3 development:

### **README.md**
Main project overview, quick start guide, and project structure

### **V3_MIGRATION_COMPLETE.md**
Complete V3 migration guide with testing checklist and deployment info

### **FOUNDRY_AUDIT_SUMMARY.md**
Comprehensive security audit results (October 2025)
- Grade: A+
- No high-severity issues
- Detailed findings and recommendations

---

## 🗄 Archived Documentation

Historical documentation moved to `docs/archive/` for reference:

### Implementation Guides
- `ADMIN_PANEL_IPFS_GUIDE.md` - IPFS integration guide
- `PINATA_SETUP_GUIDE.md` - Pinata configuration
- `ON_CHAIN_REGISTRY_GUIDE.md` - Registry implementation details
- `GROK_INTEGRATION.md` - AI price analysis integration

### Feature Specifications
- `ASSET_TYPE_LOGIC.md` - Tokens vs Points logic
- `POINTS_SETTLEMENT_FLOW.md` - Off-chain settlement system
- `PROOF_SUBMISSION_SYSTEM.md` - Proof verification flow
- `TOKEN_ADDRESS_STRATEGY.md` - V2 token address approach
- `GOOD_TIL_CANCEL_IMPLEMENTATION.md` - GTC order feature

### Development Logs
- `FRONTEND_V2_UPDATE.md` - V2 frontend changes
- `FRONTEND_GTC_UPDATES.md` - GTC UI implementation
- `TGE_SETTLEMENT_UPDATE.md` - Settlement flow updates
- `FIX_REGISTRY.md` - Registry bug fixes

### Migration & Deployment
- `V3_DEPLOYMENT_SUMMARY.md` - Initial V3 deployment
- `V3_SUMMARY.md` - V3 feature summary
- `DEPLOYMENT_V2.md` - V2 deployment history
- `AUDIT_FEEDBACK_V3.md` - Auditor recommendations

### Security
- `SECURITY_AUDIT.md` - Initial security review
- `SECURITY_FIXES_APPLIED.md` - Security patches log

### Utilities
- `CACHE_CLEAR.md` - Cache clearing for Netlify
- `NEW_ORDERBOOK_ADDRESS.txt` - Contract addresses log
- `test-grok.sh` - Grok API testing script
- `audit-package/` - Contract audit package for auditors
- `otcx-audit-package.zip` - Zipped audit package

---

## 🔄 Version History

### V3 (Current - October 2025)
- **bytes32 project identifiers**: Using `keccak256(slug)` instead of token addresses
- **IPFS metadata**: Logos and project info stored off-chain
- **Solady libraries**: Battle-tested security patterns
- **Gas optimizations**: Batch TGE activation, single-tx order taking
- **Auto-settlement**: Buyer receives tokens immediately on seller deposit

**Contracts:**
- `ProjectRegistryV2.sol`
- `EscrowOrderBookV3.sol`

### V2 (Archived)
- On-chain metadata storage
- Placeholder token addresses for pre-TGE projects
- Separate deposit functions
- Manual claim process

**Contracts:**
- `ProjectRegistry.sol`
- `EscrowOrderBookV2.sol`

### V1 (Archived)
- Basic orderbook functionality
- Limited TGE support

**Contracts:**
- `EscrowOrderBook.sol`

---

## 📖 How to Use This Documentation

### For New Developers
1. Start with `/README.md` for project overview
2. Read `/V3_MIGRATION_COMPLETE.md` for V3 specifics
3. Check `/FOUNDRY_AUDIT_SUMMARY.md` for security practices
4. Refer to archived docs only if working with legacy code

### For Auditors
- Primary: `/FOUNDRY_AUDIT_SUMMARY.md`
- Contracts: `contracts/src/EscrowOrderBookV3.sol` & `ProjectRegistryV2.sol`
- Tests: `contracts/test/`

### For DevOps
- Deployment: `/V3_MIGRATION_COMPLETE.md` (Deployment section)
- Environment: `frontend/.env.local.example`
- CI/CD: Connected via Netlify (auto-deploy on push)

---

## 🧹 Archive Policy

Documents are archived when:
- They reference deprecated contract versions (V1, V2)
- They describe features no longer in use
- They are superseded by newer documentation
- They are historical development logs

Archived documents are kept for:
- Historical reference
- Troubleshooting legacy issues
- Understanding design decisions
- Auditor review (if needed)

---

## 📝 Documentation Standards

When creating new documentation:

### Naming Convention
- Use SCREAMING_SNAKE_CASE for technical docs
- Use descriptive names (e.g., `FEATURE_IMPLEMENTATION.md`)
- Include version if applicable (e.g., `V3_FEATURE.md`)

### Structure
```markdown
# Title

**Date**: YYYY-MM-DD  
**Version**: V3  
**Status**: Active / Archived

## Overview
Brief description

## Details
Implementation details

## Examples
Code examples

## References
Links to related docs
```

### Keep It Updated
- Update docs when features change
- Archive docs when features are deprecated
- Link related documents
- Include code examples

---

## 🔗 External Resources

- **Foundry Book**: https://book.getfoundry.sh/
- **Solady Docs**: https://github.com/Vectorized/solady
- **wagmi Docs**: https://wagmi.sh/
- **Next.js Docs**: https://nextjs.org/docs
- **Pinata Docs**: https://docs.pinata.cloud/

---

**Last Updated**: October 22, 2025  
**Maintainer**: otcX Development Team


