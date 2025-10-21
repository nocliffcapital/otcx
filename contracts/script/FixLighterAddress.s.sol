// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/ProjectRegistry.sol";

contract FixLighterAddressScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address registryAddress = vm.envAddress("REGISTRY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        ProjectRegistry registry = ProjectRegistry(registryAddress);
        
        // Reset Lighter's token address to the original deterministic address
        // This matches what orders were created with
        address lighterDeterministicAddress = 0x000000000000000000000000000000006C696768;
        
        console2.log("Updating Lighter token address to:", lighterDeterministicAddress);
        
        registry.updateProject(
            "lighter",
            "Lighter",
            lighterDeterministicAddress,  // Back to deterministic address
            "Points",
            "https://x.com/lighter_xyz",
            "https://lighter.xyz",
            "Lighter is a high-performance orderbook DEX built for derivatives trading",
            "" // logoUrl
        );
        
        console2.log("Lighter token address restored!");
        console2.log("\nNow when you activate TGE, you'll provide the ACTUAL token address");
        console2.log("Example: activateTGE(orderId, 0x1234567890123456789012345678901234567890)");
        
        vm.stopBroadcast();
    }
}

