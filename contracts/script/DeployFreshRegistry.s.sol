// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ProjectRegistryV2} from "../src/ProjectRegistryV2.sol";

contract DeployFreshRegistry is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy a completely fresh Registry with NO projects
        ProjectRegistryV2 registry = new ProjectRegistryV2();
        
        vm.stopBroadcast();
        
        console.log("=== Fresh Registry Deployed ===");
        console.log("Registry Address:", address(registry));
        console.log("Owner:", registry.owner());
        console.log("Projects Count: 0 (completely empty)");
        console.log("");
        console.log("Update your Netlify environment variable:");
        console.log("NEXT_PUBLIC_REGISTRY=%s", address(registry));
    }
}
