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
        registry.addProject("eigen", "EigenLayer", address(0x123), "Points", "https://twitter.com/eigen", "https://eigen.xyz", "Test description", "" // logoUrl
        );
        
        ProjectRegistry.Project memory project = registry.getProject("eigen", "" // logoUrl
        );
        assertEq(project.slug, "eigen", "" // logoUrl
        );
        assertEq(project.name, "EigenLayer", "" // logoUrl
        );
        assertEq(project.tokenAddress, address(0x123));
        assertEq(project.assetType, "Points", "" // logoUrl
        );
        assertEq(project.twitterUrl, "https://twitter.com/eigen", "" // logoUrl
        );
        assertEq(project.websiteUrl, "https://eigen.xyz", "" // logoUrl
        );
        assertEq(project.description, "Test description", "" // logoUrl
        );
        assertTrue(project.active);
    }

    function testCannotAddDuplicateProject() public {
        registry.addProject("eigen", "EigenLayer", address(0x123), "Points", "", "", "", "" // logoUrl
        );
        
        vm.expectRevert("Project exists", "" // logoUrl
        );
        registry.addProject("eigen", "EigenLayer 2", address(0x456), "Tokens", "", "", "", "" // logoUrl
        );
    }

    function testOnlyOwnerCanAdd() public {
        vm.prank(user);
        vm.expectRevert("Not owner", "" // logoUrl
        );
        registry.addProject("eigen", "EigenLayer", address(0x123), "Points", "", "", "", "" // logoUrl
        );
    }

    function testUpdateProject() public {
        registry.addProject("eigen", "EigenLayer", address(0x123), "Points", "https://twitter.com/eigen", "https://eigen.xyz", "Old description", "" // logoUrl
        );
        registry.updateProject("eigen", "EigenLayer Updated", address(0x456), "Tokens", "https://twitter.com/eigen2", "https://eigen2.xyz", "New description", "" // logoUrl
        );
        
        ProjectRegistry.Project memory project = registry.getProject("eigen", "" // logoUrl
        );
        assertEq(project.name, "EigenLayer Updated", "" // logoUrl
        );
        assertEq(project.tokenAddress, address(0x456));
        assertEq(project.assetType, "Tokens", "" // logoUrl
        );
        assertEq(project.twitterUrl, "https://twitter.com/eigen2", "" // logoUrl
        );
        assertEq(project.websiteUrl, "https://eigen2.xyz", "" // logoUrl
        );
        assertEq(project.description, "New description", "" // logoUrl
        );
    }

    function testSetProjectStatus() public {
        registry.addProject("eigen", "EigenLayer", address(0x123), "Points", "", "", "", "" // logoUrl
        );
        registry.setProjectStatus("eigen", false);
        
        ProjectRegistry.Project memory project = registry.getProject("eigen", "" // logoUrl
        );
        assertFalse(project.active);
    }

    function testGetAllSlugs() public {
        registry.addProject("eigen", "EigenLayer", address(0x123), "Points", "", "", "", "" // logoUrl
        );
        registry.addProject("blast", "Blast", address(0x456), "Points", "", "", "", "" // logoUrl
        );
        
        string[] memory slugs = registry.getAllSlugs();
        assertEq(slugs.length, 2);
        assertEq(slugs[0], "eigen", "" // logoUrl
        );
        assertEq(slugs[1], "blast", "" // logoUrl
        );
    }

    function testGetActiveProjects() public {
        registry.addProject("eigen", "EigenLayer", address(0x123), "Points", "", "", "", "" // logoUrl
        );
        registry.addProject("blast", "Blast", address(0x456), "Points", "", "", "", "" // logoUrl
        );
        registry.addProject("zksync", "zkSync", address(0x789), "Tokens", "", "", "", "" // logoUrl
        );
        
        registry.setProjectStatus("blast", false);
        
        ProjectRegistry.Project[] memory active = registry.getActiveProjects();
        assertEq(active.length, 2);
        assertEq(active[0].slug, "eigen", "" // logoUrl
        );
        assertEq(active[1].slug, "zksync", "" // logoUrl
        );
    }

    function testInvalidAssetType() public {
        vm.expectRevert("Invalid asset type", "" // logoUrl
        );
        registry.addProject("eigen", "EigenLayer", address(0x123), "Invalid", "", "", "", "" // logoUrl
        );
    }

    function testTransferOwnership() public {
        registry.transferOwnership(user);
        assertEq(registry.owner(), user);
        
        // Old owner can't add anymore
        vm.expectRevert("Not owner", "" // logoUrl
        );
        registry.addProject("eigen", "EigenLayer", address(0x123), "Points", "", "", "", "" // logoUrl
        );
        
        // New owner can add
        vm.prank(user);
        registry.addProject("eigen", "EigenLayer", address(0x123), "Points", "", "", "", "" // logoUrl
        );
    }
}

