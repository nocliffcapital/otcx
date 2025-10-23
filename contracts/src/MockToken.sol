// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "solady/tokens/ERC20.sol";

/**
 * @title MockToken
 * @notice A simple ERC20 token with public minting for testing Token settlements
 * @dev This is for testing purposes only - allows anyone to mint tokens
 */
contract MockToken is ERC20 {
    string private _name;
    string private _symbol;
    uint8 private _decimals;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) {
        _name = name_;
        _symbol = symbol_;
        _decimals = decimals_;
    }

    function name() public view virtual override returns (string memory) {
        return _name;
    }

    function symbol() public view virtual override returns (string memory) {
        return _symbol;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @notice Mint tokens to any address (for testing only)
     * @param to Address to mint tokens to
     * @param amount Amount to mint (in token decimals)
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

