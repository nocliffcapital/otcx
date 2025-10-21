// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/mocks/MockUSDC.sol";

contract DeployMockToken is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("\nDeploying Mock Test Token...");
        // Deploy a second MockUSDC instance to use as the project token
        MockUSDC testToken = new MockUSDC();
        
        console.log("Test Token deployed at:", address(testToken));
        console.log("Name:", testToken.name());
        console.log("Symbol:", testToken.symbol());
        console.log("\nUse this address for TGE activation (NOT the USDC address)");
        
        vm.stopBroadcast();
    }
}

