// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "solady/tokens/ERC20.sol";
import {Ownable} from "solady/auth/Ownable.sol";

/**
 * @title MockUSDT
 * @notice Mock USDT token for testing (6 decimals)
 * @dev Mimics USDT behavior on Ethereum
 */
contract MockUSDT is ERC20, Ownable {
    constructor() {
        _initializeOwner(msg.sender);
    }

    function name() public pure override returns (string memory) {
        return "Tether USD";
    }

    function symbol() public pure override returns (string memory) {
        return "USDT";
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint tokens to an address (testing only)
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @notice Burn tokens from an address (testing only)
    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }
}


