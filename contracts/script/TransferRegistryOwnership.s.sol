// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/ProjectRegistry.sol";

contract TransferRegistryOwnershipScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address registryAddress = vm.envAddress("REGISTRY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        ProjectRegistry registry = ProjectRegistry(registryAddress);
        
        address currentOwner = registry.owner();
        console2.log("Current Registry owner:", currentOwner);
        console2.log("Deployer address:", vm.addr(deployerPrivateKey));
        
        // Transfer to your current wallet
        address newOwner = 0x611eDd6BC4EF1Ab11cf8B6Cc8f9B4FAEB41B6F55;
        
        console2.log("\nTransferring ownership to:", newOwner);
        registry.transferOwnership(newOwner);
        
        console2.log("Ownership transferred!");
        console2.log("\nNow you can access the admin panel with wallet:", newOwner);
        
        vm.stopBroadcast();
    }
}

