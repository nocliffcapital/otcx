// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ProjectRegistry
 * @notice On-chain registry for pre-TGE projects available for OTC trading
 */
contract ProjectRegistry {
    struct Project {
        string slug;           // URL-friendly identifier (e.g., "eigen")
        string name;           // Display name (e.g., "EigenLayer")
        address tokenAddress;  // Expected token contract address (can be zero if not yet deployed)
        string assetType;      // "Points" or "Tokens"
        bool active;           // Whether project is currently tradeable
        uint256 addedAt;       // Timestamp when added
        string twitterUrl;     // Project's Twitter/X URL
        string websiteUrl;     // Project's official website
        string description;    // Brief project description
        string logoUrl;        // Project logo/icon URL
    }

    // Mapping from slug => Project
    mapping(string => Project) public projects;
    
    // Array of all slugs for enumeration
    string[] public slugs;
    
    // Mapping to check if slug exists
    mapping(string => bool) public slugExists;

    address public owner;

    event ProjectAdded(string indexed slug, string name, address tokenAddress, string assetType);
    event ProjectUpdated(string indexed slug, string name, address tokenAddress, string assetType);
    event ProjectStatusChanged(string indexed slug, bool active);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Add a new project to the registry
     */
    function addProject(
        string memory slug,
        string memory name,
        address tokenAddress,
        string memory assetType,
        string memory twitterUrl,
        string memory websiteUrl,
        string memory description,
        string memory logoUrl
    ) external onlyOwner {
        require(bytes(slug).length > 0, "Empty slug");
        require(bytes(name).length > 0, "Empty name");
        require(!slugExists[slug], "Project exists");
        require(
            keccak256(bytes(assetType)) == keccak256(bytes("Points")) || 
            keccak256(bytes(assetType)) == keccak256(bytes("Tokens")),
            "Invalid asset type"
        );

        projects[slug] = Project({
            slug: slug,
            name: name,
            tokenAddress: tokenAddress,
            assetType: assetType,
            active: true,
            addedAt: block.timestamp,
            twitterUrl: twitterUrl,
            websiteUrl: websiteUrl,
            description: description,
            logoUrl: logoUrl
        });

        slugs.push(slug);
        slugExists[slug] = true;

        emit ProjectAdded(slug, name, tokenAddress, assetType);
    }

    /**
     * @notice Update an existing project
     */
    function updateProject(
        string memory slug,
        string memory name,
        address tokenAddress,
        string memory assetType,
        string memory twitterUrl,
        string memory websiteUrl,
        string memory description,
        string memory logoUrl
    ) external onlyOwner {
        require(slugExists[slug], "Project not found");
        require(bytes(name).length > 0, "Empty name");
        require(
            keccak256(bytes(assetType)) == keccak256(bytes("Points")) || 
            keccak256(bytes(assetType)) == keccak256(bytes("Tokens")),
            "Invalid asset type"
        );

        Project storage project = projects[slug];
        project.name = name;
        project.tokenAddress = tokenAddress;
        project.assetType = assetType;
        project.twitterUrl = twitterUrl;
        project.websiteUrl = websiteUrl;
        project.description = description;
        project.logoUrl = logoUrl;

        emit ProjectUpdated(slug, name, tokenAddress, assetType);
    }

    /**
     * @notice Toggle project active status
     */
    function setProjectStatus(string memory slug, bool active) external onlyOwner {
        require(slugExists[slug], "Project not found");
        projects[slug].active = active;
        emit ProjectStatusChanged(slug, active);
    }

    /**
     * @notice Get project by slug
     */
    function getProject(string memory slug) external view returns (Project memory) {
        require(slugExists[slug], "Project not found");
        return projects[slug];
    }

    /**
     * @notice Get all project slugs
     */
    function getAllSlugs() external view returns (string[] memory) {
        return slugs;
    }

    /**
     * @notice Get all active projects
     */
    function getActiveProjects() external view returns (Project[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < slugs.length; i++) {
            if (projects[slugs[i]].active) {
                activeCount++;
            }
        }

        Project[] memory activeProjects = new Project[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < slugs.length; i++) {
            if (projects[slugs[i]].active) {
                activeProjects[index] = projects[slugs[i]];
                index++;
            }
        }

        return activeProjects;
    }

    /**
     * @notice Get total project count
     */
    function getProjectCount() external view returns (uint256) {
        return slugs.length;
    }

    /**
     * @notice Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

