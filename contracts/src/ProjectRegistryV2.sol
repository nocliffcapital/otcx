// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "solady/auth/Ownable.sol";

/**
 * @title ProjectRegistryV2
 * @notice Minimal on-chain registry - metadata stored off-chain (IPFS/Arweave)
 * @dev Only stores essential data on-chain, links to off-chain metadata
 * 
 * PROJECT ID HASHING:
 * - Uses keccak256(abi.encodePacked(slug)) for project IDs
 * - Consistent with EscrowOrderBookV4 for seamless integration
 * - Frontend uses viem's keccak256(toBytes(slug)) which matches
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

    // Active project optimization: O(1) access to active projects
    bytes32[] public activeProjectIds;
    mapping(bytes32 => uint256) private activeProjectIndex; // 1-indexed (0 = not in array)

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
        require(bytes(metadataURI).length > 0 && bytes(metadataURI).length <= 256, "INVALID_METADATA_URI");
        
        // Token address validation to prevent invalid states
        if (isPoints) {
            // Points projects should not have a token address initially
            // (can be updated later if points convert to tokens)
            require(tokenAddress == address(0), "POINTS_PROJECT_CANNOT_HAVE_TOKEN");
        } else {
            // Token projects can have address(0) (pre-TGE) or deployed contract
            if (tokenAddress != address(0)) {
                require(tokenAddress.code.length > 0, "TOKEN_NOT_DEPLOYED");
            }
        }
        
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
        
        // Add to active projects index (project starts as active)
        activeProjectIds.push(id);
        activeProjectIndex[id] = activeProjectIds.length; // 1-indexed

        emit ProjectAdded(id, name, metadataURI);
    }

    /**
     * @notice Update project core data (name, token address)
     * @dev To change active status, use setProjectStatus() to maintain index consistency
     */
    function updateProject(
        bytes32 id,
        string memory name,
        address tokenAddress
    ) external onlyOwner {
        require(projects[id].addedAt > 0, "PROJECT_NOT_FOUND");
        require(bytes(name).length > 0 && bytes(name).length <= 50, "INVALID_NAME");

        Project storage project = projects[id];
        project.name = name;
        project.tokenAddress = tokenAddress;

        emit ProjectUpdated(id, name, tokenAddress);
    }

    /**
     * @notice Update metadata URI (cheap to update off-chain data)
     */
    function updateMetadata(bytes32 id, string memory metadataURI) external onlyOwner {
        require(projects[id].addedAt > 0, "PROJECT_NOT_FOUND");
        require(bytes(metadataURI).length > 0 && bytes(metadataURI).length <= 256, "INVALID_METADATA_URI");
        projects[id].metadataURI = metadataURI;
        emit MetadataUpdated(id, metadataURI);
    }
    
    /**
     * @notice Update token address for a project (e.g., when Points convert to tokens)
     * @dev Can only update if current address is 0x0 or if converting Points to Token before TGE
     * @param id Project identifier
     * @param newTokenAddress New token contract address
     */
    function updateTokenAddress(bytes32 id, address newTokenAddress) external onlyOwner {
        require(projects[id].addedAt > 0, "PROJECT_NOT_FOUND");
        require(newTokenAddress != address(0), "INVALID_TOKEN_ADDRESS");
        require(newTokenAddress.code.length > 0, "TOKEN_NOT_DEPLOYED");
        
        Project storage project = projects[id];
        
        // Only allow update if:
        // 1. Current address is 0x0 (not set yet), OR
        // 2. Project is Points type (can upgrade to token settlement)
        require(
            project.tokenAddress == address(0) || project.isPoints,
            "TOKEN_ALREADY_SET"
        );
        
        project.tokenAddress = newTokenAddress;
        // If was Points project, keep isPoints = true (hybrid mode)
        // OrderBook will decide settlement method when TGE is activated
        
        emit ProjectUpdated(id, project.name, newTokenAddress);
    }

    /**
     * @notice Toggle project active status
     * @dev Maintains activeProjectIds array for O(1) getActiveProjects()
     */
    function setProjectStatus(bytes32 id, bool active) external onlyOwner {
        require(projects[id].addedAt > 0, "PROJECT_NOT_FOUND");
        
        bool wasActive = projects[id].active;
        if (wasActive == active) return; // No change needed
        
        projects[id].active = active;
        
        // Update active projects index
        if (active && !wasActive) {
            // Add to active list
            activeProjectIds.push(id);
            activeProjectIndex[id] = activeProjectIds.length; // 1-indexed
        } else if (!active && wasActive) {
            // Remove from active list using swap-and-pop
            uint256 index = activeProjectIndex[id];
            require(index > 0, "NOT_IN_ACTIVE_LIST"); // Safety check
            
            uint256 lastIndex = activeProjectIds.length;
            bytes32 lastId = activeProjectIds[lastIndex - 1];
            
            // Swap with last element and pop
            activeProjectIds[index - 1] = lastId; // Convert to 0-indexed
            activeProjectIndex[lastId] = index;
            activeProjectIds.pop();
            delete activeProjectIndex[id];
        }
        
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
     * @notice Get all active projects (O(1) via activeProjectIds array)
     */
    function getActiveProjects() external view returns (Project[] memory) {
        uint256 activeCount = activeProjectIds.length;
        Project[] memory activeProjects = new Project[](activeCount);
        
        for (uint256 i = 0; i < activeCount; i++) {
            activeProjects[i] = projects[activeProjectIds[i]];
        }
        
        return activeProjects;
    }
    
    /**
     * @notice Get count of active projects
     */
    function getActiveProjectCount() external view returns (uint256) {
        return activeProjectIds.length;
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
    
    // ============================================
    // INTEGRATION FUNCTIONS (for OrderBook & UI)
    // ============================================
    
    /**
     * @notice Check if a project is active and tradeable
     * @dev Used by OrderBook to validate orders at creation time
     * @param projectId The project identifier (keccak256(slug))
     * @return bool True if project exists and is active
     */
    function isActive(bytes32 projectId) external view returns (bool) {
        return projects[projectId].addedAt > 0 && projects[projectId].active;
    }
    
    /**
     * @notice Get token address for a project
     * @dev Used by OrderBook for settlement logic
     * @param projectId The project identifier
     * @return address Token address (0x0 if not set yet)
     */
    function getTokenAddress(bytes32 projectId) external view returns (address) {
        require(projects[projectId].addedAt > 0, "PROJECT_NOT_FOUND");
        return projects[projectId].tokenAddress;
    }
    
    /**
     * @notice Check if a project uses Points (off-chain) settlement
     * @dev Used by OrderBook and UI to determine settlement flow
     * @param projectId The project identifier
     * @return bool True if Points project, false if Token project
     */
    function isPointsProject(bytes32 projectId) external view returns (bool) {
        require(projects[projectId].addedAt > 0, "PROJECT_NOT_FOUND");
        return projects[projectId].isPoints;
    }
    
    /**
     * @notice Check if a project exists
     * @param projectId The project identifier
     * @return bool True if project has been added
     */
    function exists(bytes32 projectId) external view returns (bool) {
        return projects[projectId].addedAt > 0;
    }
}

