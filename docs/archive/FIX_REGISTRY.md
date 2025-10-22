# Quick Fix for Logo URL Feature

The registry contract was updated to include `logoUrl`, but the old contract on-chain doesn't have it.

## Solution: Deploy Fresh Registry

Run this command:

```bash
cd contracts
forge script script/DeployFreshRegistry.s.sol:DeployFreshRegistryScript --rpc-url sepolia --broadcast --verify
```

Then update your `.env.local` with the new registry address that gets printed.

## Alternative: Revert the Frontend ABI

If you don't want to redeploy right now, you can temporarily remove logoUrl from the frontend ABI in `frontend/src/lib/contracts.ts` - just remove the `{ "name": "logoUrl", "type": "string" }` lines from the ABI until you're ready to redeploy the registry.

For now, I'll create a simple deployment script that works:

