// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/ProjectRegistryV2.sol";

contract AddProjectsScript is Script {
    function run() external {
        // Load environment variables
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address registryAddress = 0xc5e41d8DCD6dE1c35b4A82580B29562bb13dd0D2; // Latest Registry (fixed updateProject)
        
        vm.startBroadcast(deployerPrivateKey);
        
        ProjectRegistryV2 registry = ProjectRegistryV2(registryAddress);
        
        console.log("Adding projects to Registry:", registryAddress);
        console.log("");
        
        // Add Lighter (Points project)
        bytes32 lighterId = keccak256(abi.encodePacked("lighter"));
        console.log("Adding Lighter...");
        console.log("Project ID:", vm.toString(lighterId));
        
        registry.addProject(
            "lighter",
            "Lighter",
            address(0),  // tokenAddress = 0 for Points projects
            true,  // isPoints = true
            "ipfs://QmLighterMetadata"
        );
        
        console.log("Lighter added and active!");
        console.log("");
        
        // Add MegaETH (Token project - needs a real token address)
        bytes32 megaethId = keccak256(abi.encodePacked("megaeth"));
        console.log("Adding MegaETH...");
        console.log("Project ID:", vm.toString(megaethId));
        
        // MegaETH is a token project, so we either need:
        // 1. address(0) if it hasn't launched yet (will be updated later)
        // 2. actual deployed token address
        registry.addProject(
            "megaeth",
            "MegaETH",
            address(0), // No token yet, will be updated before TGE
            false,  // isPoints = false (it's a token project)
            "ipfs://QmMegaETHMetadata"
        );
        
        console.log("MegaETH added and active!");
        console.log("");
        
        vm.stopBroadcast();
        
        // Verify projects were added
        console.log("Verification:");
        console.log("Lighter active:", registry.isActive(lighterId));
        console.log("MegaETH active:", registry.isActive(megaethId));
        console.log("");
        console.log("Projects successfully added to Registry!");
    }
}

