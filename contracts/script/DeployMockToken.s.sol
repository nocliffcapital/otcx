// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MockToken.sol";

/**
 * @title DeployMockToken
 * @notice Deploys a mintable test token for settlement testing
 */
contract DeployMockToken is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);

        // Deploy MockToken with 18 decimals (standard for most tokens)
        MockToken token = new MockToken(
            "Mock MegaETH Token",  // Name
            "mMEGAETH",            // Symbol
            18                      // Decimals
        );

        vm.stopBroadcast();

        console.log("MockToken deployed to:", address(token));
        console.log("Token name:", token.name());
        console.log("Token symbol:", token.symbol());
        console.log("Token decimals:", token.decimals());
        console.log("\nAnyone can mint tokens by calling:");
        console.log("token.mint(yourAddress, amount);");
    }
}
