// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ProjectRegistry} from "../src/ProjectRegistry.sol";

contract ProjectRegistryTest is Test {
    ProjectRegistry registry;
    address owner = address(this);
    address user = address(0x1);

    function setUp() public {
        registry = new ProjectRegistry();
    }

    function testAddProject() public {
        registry.addProject("eigen", "EigenLayer", address(0x123), "Points", "https://twitter.com/eigen", "https://eigen.xyz", "Test description");
        
        ProjectRegistry.Project memory project = registry.getProject("eigen");
        assertEq(project.slug, "eigen");
        assertEq(project.name, "EigenLayer");
        assertEq(project.tokenAddress, address(0x123));
        assertEq(project.assetType, "Points");
        assertEq(project.twitterUrl, "https://twitter.com/eigen");
        assertEq(project.websiteUrl, "https://eigen.xyz");
        assertEq(project.description, "Test description");
        assertTrue(project.active);
    }

    function testCannotAddDuplicateProject() public {
        registry.addProject("eigen", "EigenLayer", address(0x123), "Points", "", "", "");
        
        vm.expectRevert("Project exists");
        registry.addProject("eigen", "EigenLayer 2", address(0x456), "Tokens", "", "", "");
    }

    function testOnlyOwnerCanAdd() public {
        vm.prank(user);
        vm.expectRevert("Not owner");
        registry.addProject("eigen", "EigenLayer", address(0x123), "Points", "", "", "");
    }

    function testUpdateProject() public {
        registry.addProject("eigen", "EigenLayer", address(0x123), "Points", "https://twitter.com/eigen", "https://eigen.xyz", "Old description");
        registry.updateProject("eigen", "EigenLayer Updated", address(0x456), "Tokens", "https://twitter.com/eigen2", "https://eigen2.xyz", "New description");
        
        ProjectRegistry.Project memory project = registry.getProject("eigen");
        assertEq(project.name, "EigenLayer Updated");
        assertEq(project.tokenAddress, address(0x456));
        assertEq(project.assetType, "Tokens");
        assertEq(project.twitterUrl, "https://twitter.com/eigen2");
        assertEq(project.websiteUrl, "https://eigen2.xyz");
        assertEq(project.description, "New description");
    }

    function testSetProjectStatus() public {
        registry.addProject("eigen", "EigenLayer", address(0x123), "Points", "", "", "");
        registry.setProjectStatus("eigen", false);
        
        ProjectRegistry.Project memory project = registry.getProject("eigen");
        assertFalse(project.active);
    }

    function testGetAllSlugs() public {
        registry.addProject("eigen", "EigenLayer", address(0x123), "Points", "", "", "");
        registry.addProject("blast", "Blast", address(0x456), "Points", "", "", "");
        
        string[] memory slugs = registry.getAllSlugs();
        assertEq(slugs.length, 2);
        assertEq(slugs[0], "eigen");
        assertEq(slugs[1], "blast");
    }

    function testGetActiveProjects() public {
        registry.addProject("eigen", "EigenLayer", address(0x123), "Points", "", "", "");
        registry.addProject("blast", "Blast", address(0x456), "Points", "", "", "");
        registry.addProject("zksync", "zkSync", address(0x789), "Tokens", "", "", "");
        
        registry.setProjectStatus("blast", false);
        
        ProjectRegistry.Project[] memory active = registry.getActiveProjects();
        assertEq(active.length, 2);
        assertEq(active[0].slug, "eigen");
        assertEq(active[1].slug, "zksync");
    }

    function testInvalidAssetType() public {
        vm.expectRevert("Invalid asset type");
        registry.addProject("eigen", "EigenLayer", address(0x123), "Invalid", "", "", "");
    }

    function testTransferOwnership() public {
        registry.transferOwnership(user);
        assertEq(registry.owner(), user);
        
        // Old owner can't add anymore
        vm.expectRevert("Not owner");
        registry.addProject("eigen", "EigenLayer", address(0x123), "Points", "", "", "");
        
        // New owner can add
        vm.prank(user);
        registry.addProject("eigen", "EigenLayer", address(0x123), "Points", "", "", "");
    }
}

