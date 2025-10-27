// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ProjectRegistryV2 as ProjectRegistry} from "../src/ProjectRegistryV2.sol";

contract ProjectRegistryTest is Test {
    ProjectRegistry registry;
    address owner = address(this);
    address user = address(0x1);

    function setUp() public {
        registry = new ProjectRegistry();
    }

    function testAddProject() public {
        // Points projects must have address(0) for tokenAddress
        registry.addProject("eigen", "EigenLayer", address(0), true, "ipfs://metadata");
        
        ProjectRegistry.Project memory project = registry.getProjectBySlug("eigen");
        assertEq(project.name, "EigenLayer");
        assertEq(project.tokenAddress, address(0));
        assertTrue(project.isPoints);
        assertEq(project.metadataURI, "ipfs://metadata");
        assertTrue(project.active);
    }

    function testCannotAddDuplicateProject() public {
        // Points projects must have address(0)
        registry.addProject("eigen", "EigenLayer", address(0), true, "ipfs://metadata");
        
        vm.expectRevert("PROJECT_EXISTS");
        registry.addProject("eigen", "EigenLayer 2", address(0), false, "ipfs://metadata2");
    }

    function testOnlyOwnerCanAdd() public {
        vm.prank(user);
        vm.expectRevert();
        registry.addProject("eigen", "EigenLayer", address(0), true, "ipfs://metadata");
    }

    function testSetProjectStatus() public {
        registry.addProject("eigen", "EigenLayer", address(0), true, "ipfs://metadata");
        bytes32 projectId = keccak256(abi.encodePacked("eigen"));
        registry.setProjectStatus(projectId, false);
        
        ProjectRegistry.Project memory project = registry.getProjectBySlug("eigen");
        assertFalse(project.active);
    }
}
