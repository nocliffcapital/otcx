// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/ProjectRegistryV2.sol";

/**
 * @title TransferOwnership
 * @notice Transfer ownership of ProjectRegistryV2 to a new address
 */
contract TransferOwnership is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address newOwner = vm.envAddress("NEW_OWNER");
        address registryAddress = 0x7fdBE0DEA92E1e246276DCb50c6d7Dc910563D22;
        
        vm.startBroadcast(deployerPrivateKey);

        ProjectRegistryV2 registry = ProjectRegistryV2(registryAddress);
        
        console.log("=== Transferring Ownership ===");
        console.log("Registry:", registryAddress);
        console.log("Current Owner:", registry.owner());
        console.log("New Owner:", newOwner);
        
        registry.transferOwnership(newOwner);
        
        console.log("\nOwnership transferred!");
        console.log("New Owner:", registry.owner());

        vm.stopBroadcast();
    }
}

