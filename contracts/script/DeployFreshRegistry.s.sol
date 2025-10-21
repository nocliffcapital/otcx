// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/ProjectRegistry.sol";

contract DeployFreshRegistry is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("\n=== DEPLOYING FRESH REGISTRY ===\n");
        
        // Deploy fresh ProjectRegistry (empty - user will add projects manually)
        console.log("Deploying empty ProjectRegistry...");
        ProjectRegistry registry = new ProjectRegistry();
        console.log("Registry deployed at:", address(registry));
        console.log("Owner:", registry.owner());
        
        console.log("\n=== DEPLOYMENT COMPLETE ===\n");
        console.log("Update your frontend/.env.local with:\n");
        console.log("NEXT_PUBLIC_REGISTRY=", address(registry));
        console.log("\nKeep existing:");
        console.log("NEXT_PUBLIC_STABLE=0xd5d56a9Cd59550c6D95569620F7eb89C1E4c9101");
        console.log("NEXT_PUBLIC_ORDERBOOK=0x192A4A6b2bb16393802Be621D805dAc64C617DBf");
        console.log("\n");
        
        vm.stopBroadcast();
    }
}

