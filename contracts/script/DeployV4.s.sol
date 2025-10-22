// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ProjectRegistryV2} from "../src/ProjectRegistryV2.sol";
import {EscrowOrderBookV4} from "../src/EscrowOrderBookV4.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockUSDT} from "../src/mocks/MockUSDT.sol";

/**
 * @title DeployV4
 * @notice Deployment script for V4 contracts with USDC + USDT support
 * @dev Run with: forge script script/DeployV4.s.sol:DeployV4 --rpc-url $RPC_URL --broadcast
 */
contract DeployV4 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer:", deployer);
        console.log("Deployer balance:", deployer.balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy MockUSDC (6 decimals)
        MockUSDC usdc = new MockUSDC();
        console.log("MockUSDC deployed at:", address(usdc));
        
        // 2. Deploy MockUSDT (6 decimals)
        MockUSDT usdt = new MockUSDT();
        console.log("MockUSDT deployed at:", address(usdt));
        
        // 3. Mint initial supply to deployer
        usdc.mint(deployer, 1_000_000 * 10**6);  // 1M USDC
        usdt.mint(deployer, 1_000_000 * 10**6);  // 1M USDT
        console.log("Minted 1M USDC and 1M USDT to deployer");
        
        // 4. Deploy ProjectRegistryV2
        ProjectRegistryV2 registry = new ProjectRegistryV2();
        console.log("ProjectRegistryV2 deployed at:", address(registry));
        
        // 5. Deploy EscrowOrderBookV4 (with USDC as primary)
        EscrowOrderBookV4 orderbook = new EscrowOrderBookV4(
            address(usdc),
            deployer  // Fee collector = deployer for now
        );
        console.log("EscrowOrderBookV4 deployed at:", address(orderbook));
        
        // 6. Approve USDT as additional collateral
        orderbook.approveCollateral(address(usdt));
        console.log("USDT approved as collateral");
        
        // 7. Add test project: Lighter (Points)
        registry.addProject(
            "lighter",
            "Lighter",
            address(0),  // No token yet (Points project)
            true,        // isPoints = true
            "ipfs://QmRYhCw2gWkKQi8qwWuDyzE6rDp7GMe1iYWEDhEQFPH2Nx"
        );
        console.log("Added Lighter project");
        
        vm.stopBroadcast();
        
        // Print summary
        console.log("\n========================================");
        console.log("V4 DEPLOYMENT SUMMARY");
        console.log("========================================");
        console.log("MockUSDC:", address(usdc));
        console.log("MockUSDT:", address(usdt));
        console.log("ProjectRegistryV2:", address(registry));
        console.log("EscrowOrderBookV4:", address(orderbook));
        console.log("Fee Collector:", deployer);
        console.log("========================================");
        console.log("\nUpdate your .env.local with:");
        console.log(string.concat("NEXT_PUBLIC_REGISTRY=", vm.toString(address(registry))));
        console.log(string.concat("NEXT_PUBLIC_ORDERBOOK=", vm.toString(address(orderbook))));
        console.log(string.concat("NEXT_PUBLIC_STABLE=", vm.toString(address(usdc))));
        console.log("NEXT_PUBLIC_STABLE_DECIMALS=6");
        console.log(string.concat("NEXT_PUBLIC_USDT=", vm.toString(address(usdt))));
    }
}

