// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/EscrowOrderBookV2.sol";

contract UpgradeOrderbook is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address stable = 0xd5d56a9Cd59550c6D95569620F7eb89C1E4c9101;
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("Deploying new EscrowOrderBookV2 with batchActivateTGE...");
        EscrowOrderBookV2 orderbook = new EscrowOrderBookV2(stable);
        
        console.log("\nNew Orderbook deployed at:", address(orderbook));
        console.log("\nUpdate your .env.local with:");
        console.log("NEXT_PUBLIC_ORDERBOOK=", address(orderbook));
        
        vm.stopBroadcast();
    }
}

