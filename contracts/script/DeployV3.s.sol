// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/ProjectRegistryV2.sol";
import "../src/EscrowOrderBookV3.sol";

contract DeployV3Script is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("\n=== DEPLOYING V3 CONTRACTS ===\n");
        
        // MockUSDC address on Sepolia
        address mockUSDC = 0xd5d56a9Cd59550c6D95569620F7eb89C1E4c9101;
        
        // Deploy ProjectRegistryV2
        console.log("  Deploying ProjectRegistryV2...");
        ProjectRegistryV2 registry = new ProjectRegistryV2();
        console.log("  Registry deployed at:", address(registry));
        console.log("  Owner:", registry.owner());
        
        // Deploy EscrowOrderBookV3
        console.log("\n  Deploying EscrowOrderBookV3...");
        EscrowOrderBookV3 orderbook = new EscrowOrderBookV3(mockUSDC);
        console.log("  Orderbook deployed at:", address(orderbook));
        console.log("  Owner:", orderbook.owner());
        console.log("  Stable token:", address(orderbook.stable()));
        
        console.log("\n=== DEPLOYMENT COMPLETE ===\n");
        console.log("Update your frontend/.env.local with:\n");
        console.log("NEXT_PUBLIC_REGISTRY=", address(registry));
        console.log("NEXT_PUBLIC_ORDERBOOK=", address(orderbook));
        console.log("NEXT_PUBLIC_STABLE=", mockUSDC);
        console.log("\n");
        
        vm.stopBroadcast();
    }
}

