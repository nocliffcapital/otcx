// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/EscrowOrderBookV2.sol";
import "../src/ProjectRegistry.sol";

contract FreshDeploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Use existing MockUSDC
        address stable = 0xd5d56a9Cd59550c6D95569620F7eb89C1E4c9101;
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("\n=== FRESH DEPLOYMENT ===\n");
        
        // Deploy fresh ProjectRegistry (empty - user will add projects manually)
        console.log("1. Deploying empty ProjectRegistry...");
        ProjectRegistry registry = new ProjectRegistry();
        console.log("   Registry deployed at:", address(registry));
        
        // Deploy new EscrowOrderBookV2 with batchActivateTGE
        console.log("\n2. Deploying EscrowOrderBookV2 with batch TGE...");
        EscrowOrderBookV2 orderbook = new EscrowOrderBookV2(stable);
        console.log("   Orderbook deployed at:", address(orderbook));
        
        console.log("\n=== DEPLOYMENT COMPLETE ===\n");
        console.log("Update your frontend/.env.local with:\n");
        console.log("NEXT_PUBLIC_STABLE=0xd5d56a9Cd59550c6D95569620F7eb89C1E4c9101");
        console.log("NEXT_PUBLIC_ORDERBOOK=", address(orderbook));
        console.log("NEXT_PUBLIC_REGISTRY=", address(registry));
        console.log("NEXT_PUBLIC_STABLE_DECIMALS=6");
        console.log("NEXT_PUBLIC_ALCHEMY_KEY=k_iqdWRXcHcwawa8lzv_R");
        console.log("NEXT_PUBLIC_RPC=https://eth-sepolia.g.alchemy.com/v2/k_iqdWRXcHcwawa8lzv_R");
        console.log("\n");
        
        vm.stopBroadcast();
    }
}

