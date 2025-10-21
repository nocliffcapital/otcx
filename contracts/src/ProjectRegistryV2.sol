// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "solady/auth/Ownable.sol";

/**
 * @title ProjectRegistryV2
 * @notice Minimal on-chain registry - metadata stored off-chain (IPFS/Arweave)
 * @dev Only stores essential data on-chain, links to off-chain metadata
 */
contract ProjectRegistryV2 is Ownable {
    struct Project {
        bytes32 id;            // keccak256(slug) - efficient identifier
        string name;           // Display name (short, max 50 chars)
        address tokenAddress;  // Actual token address (0x0 before TGE)
        bool isPoints;         // true = Points, false = Tokens
        bool active;           // Whether project is tradeable
        uint64 addedAt;        // Timestamp when added
        string metadataURI;    // IPFS/Arweave link to full metadata (twitter, website, description, logo)
    }

    // Mapping from projectId (bytes32) => Project
    mapping(bytes32 => Project) public projects;
    
    // Array of all project IDs for enumeration
    bytes32[] public projectIds;

    event ProjectAdded(bytes32 indexed id, string name, string metadataURI);
    event ProjectUpdated(bytes32 indexed id, string name, address tokenAddress);
    event MetadataUpdated(bytes32 indexed id, string metadataURI);
    event ProjectStatusChanged(bytes32 indexed id, bool active);

    constructor() {
        _initializeOwner(msg.sender);
    }

    /**
     * @notice Add a new project (minimal on-chain data)
     * @param slug URL-friendly identifier (e.g., "lighter")
     * @param name Display name (e.g., "Lighter")
     * @param tokenAddress Token address (0x0 if not yet deployed)
     * @param isPoints true for Points projects, false for Tokens
     * @param metadataURI Link to off-chain metadata (IPFS, Arweave, etc.)
     */
    function addProject(
        string memory slug,
        string memory name,
        address tokenAddress,
        bool isPoints,
        string memory metadataURI
    ) external onlyOwner {
        require(bytes(slug).length > 0 && bytes(slug).length <= 50, "INVALID_SLUG");
        require(bytes(name).length > 0 && bytes(name).length <= 50, "INVALID_NAME");
        
        bytes32 id = keccak256(abi.encodePacked(slug));
        require(projects[id].addedAt == 0, "PROJECT_EXISTS");

        projects[id] = Project({
            id: id,
            name: name,
            tokenAddress: tokenAddress,
            isPoints: isPoints,
            active: true,
            addedAt: uint64(block.timestamp),
            metadataURI: metadataURI
        });

        projectIds.push(id);

        emit ProjectAdded(id, name, metadataURI);
    }

    /**
     * @notice Update project core data (name, token address, active status)
     */
    function updateProject(
        bytes32 id,
        string memory name,
        address tokenAddress,
        bool active
    ) external onlyOwner {
        require(projects[id].addedAt > 0, "PROJECT_NOT_FOUND");
        require(bytes(name).length > 0 && bytes(name).length <= 50, "INVALID_NAME");

        Project storage project = projects[id];
        project.name = name;
        project.tokenAddress = tokenAddress;
        project.active = active;

        emit ProjectUpdated(id, name, tokenAddress);
    }

    /**
     * @notice Update metadata URI (cheap to update off-chain data)
     */
    function updateMetadata(bytes32 id, string memory metadataURI) external onlyOwner {
        require(projects[id].addedAt > 0, "PROJECT_NOT_FOUND");
        projects[id].metadataURI = metadataURI;
        emit MetadataUpdated(id, metadataURI);
    }

    /**
     * @notice Toggle project active status
     */
    function setProjectStatus(bytes32 id, bool active) external onlyOwner {
        require(projects[id].addedAt > 0, "PROJECT_NOT_FOUND");
        projects[id].active = active;
        emit ProjectStatusChanged(id, active);
    }

    /**
     * @notice Get project by ID
     */
    function getProject(bytes32 id) external view returns (Project memory) {
        require(projects[id].addedAt > 0, "PROJECT_NOT_FOUND");
        return projects[id];
    }

    /**
     * @notice Get project by slug (convenience function)
     */
    function getProjectBySlug(string memory slug) external view returns (Project memory) {
        bytes32 id = keccak256(abi.encodePacked(slug));
        require(projects[id].addedAt > 0, "PROJECT_NOT_FOUND");
        return projects[id];
    }

    /**
     * @notice Get all project IDs
     */
    function getAllProjectIds() external view returns (bytes32[] memory) {
        return projectIds;
    }

    /**
     * @notice Get all active projects
     */
    function getActiveProjects() external view returns (Project[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < projectIds.length; i++) {
            if (projects[projectIds[i]].active) {
                activeCount++;
            }
        }

        Project[] memory activeProjects = new Project[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < projectIds.length; i++) {
            if (projects[projectIds[i]].active) {
                activeProjects[index] = projects[projectIds[i]];
                index++;
            }
        }

        return activeProjects;
    }

    /**
     * @notice Get total project count
     */
    function getProjectCount() external view returns (uint256) {
        return projectIds.length;
    }

    /**
     * @notice Transfer ownership (inherited from Solady Ownable)
     */

    /**
     * @notice Generate project ID from slug (utility function)
     */
    function getProjectId(string memory slug) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(slug));
    }
}

