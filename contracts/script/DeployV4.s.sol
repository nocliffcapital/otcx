// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/EscrowOrderBookV4.sol";
import "../src/ProjectRegistryV2.sol";

/**
 * @title DeployV4
 * @notice Deploys EscrowOrderBookV4 with conversion ratio support
 */
contract DeployV4 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Existing contracts on Sepolia
        address mockUSDC = 0xd5d56a9Cd59550c6D95569620F7eb89C1E4c9101;
        address registry = 0xda54Eac428C533bDD560A9f2f0d9641CBfE742B4; // Latest Registry V2 (fresh deployment)
        address feeCollector = 0x61fEDd6BC4ef1ab11cf8b6CC8F9b4Faeb41B6f55; // Your address
        
        vm.startBroadcast(deployerPrivateKey);

        // Deploy new EscrowOrderBookV4 with Registry integration
        EscrowOrderBookV4 orderbook = new EscrowOrderBookV4(
            mockUSDC,
            feeCollector,
            registry
        );

        vm.stopBroadcast();

        console.log("=== V4 Deployment Complete ===");
        console.log("EscrowOrderBookV4:", address(orderbook));
        console.log("Stable (USDC):", mockUSDC);
        console.log("Fee Collector:", feeCollector);
        console.log("Registry:", registry);
        console.log("\nUpdate your frontend .env with:");
        console.log("NEXT_PUBLIC_ORDERBOOK=", address(orderbook));
    }
}
