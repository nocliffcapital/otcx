// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/EscrowOrderBookV2.sol";

contract DeployOrderbookScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address mockUSDC = 0xd5d56a9Cd59550c6D95569620F7eb89C1E4c9101; // From deployment
        
        vm.startBroadcast(deployerPrivateKey);
        
        console2.log("Deploying EscrowOrderBookV2 with USDC:", mockUSDC);
        
        EscrowOrderBookV2 orderbook = new EscrowOrderBookV2(mockUSDC);
        
        console2.log("EscrowOrderBookV2 deployed at:", address(orderbook));
        console2.log("Owner:", orderbook.owner());
        
        vm.stopBroadcast();
    }
}

