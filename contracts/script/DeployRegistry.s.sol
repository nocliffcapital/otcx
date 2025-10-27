// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/ProjectRegistryV2.sol";

/**
 * @title DeployRegistry
 * @notice Deploys a fresh ProjectRegistryV2 contract
 */
contract DeployRegistry is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);

        // Deploy new ProjectRegistryV2
        ProjectRegistryV2 registry = new ProjectRegistryV2();

        vm.stopBroadcast();

        console.log("=== Registry V2 Deployment Complete ===");
        console.log("ProjectRegistryV2:", address(registry));
        console.log("Owner:", registry.owner());
        console.log("\nUpdate your frontend .env with:");
        console.log("NEXT_PUBLIC_REGISTRY=", address(registry));
    }
}

