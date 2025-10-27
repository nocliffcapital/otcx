/**
 * V4 Contract Configuration (Multi-chain Support)
 * 
 * Key Changes from V3:
 * - Collateral whitelist system (USDC + USDT support)
 * - SafeTransferLib for robust ERC20 handling
 * - Configurable fees (0-5% range)
 * - Per-project settlement windows
 * - View helpers for UI calculations
 * - 18-decimal token enforcement
 * - Project-level TGE activation
 * - All audit recommendations implemented
 * - Multi-chain deployment support
 */

import ProjectRegistryV2ABI from './ProjectRegistryV2.abi.json';
import EscrowOrderBookV4ABI from './abis/EscrowOrderBookV4.abi.json';
import { keccak256, toBytes } from 'viem';
import { getChainConfig } from './chains';

/**
 * Get contract addresses for current chain
 * Falls back to Sepolia if chain not configured
 */
export function getContractAddresses(chainId?: number) {
  const config = getChainConfig(chainId || 11155111);
  
  return {
    ORDERBOOK_ADDRESS: config.orderbook,
    REGISTRY_ADDRESS: config.registry,
    STABLE_ADDRESS: config.stable,
    STABLE_DECIMALS: config.stableDecimals,
    STABLE_SYMBOL: config.stableSymbol,
  };
}

// Validate required environment variables at runtime
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    // Only throw in browser/runtime, not during build
    if (typeof window !== 'undefined') {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    // During build, log warning and return empty string (will fail at runtime if actually used)
    console.warn(`⚠️  Missing environment variable: ${key}`);
    return '';
  }
  return value;
}

// Contract addresses from environment variables (REQUIRED)
export const ORDERBOOK_ADDRESS = (requireEnv('NEXT_PUBLIC_ORDERBOOK') || '0x0000000000000000000000000000000000000000') as `0x${string}`;
export const REGISTRY_ADDRESS = (requireEnv('NEXT_PUBLIC_REGISTRY') || '0x0000000000000000000000000000000000000000') as `0x${string}`;
export const STABLE_ADDRESS = (requireEnv('NEXT_PUBLIC_STABLE') || '0x0000000000000000000000000000000000000000') as `0x${string}`;
export const STABLE_DECIMALS = Number(requireEnv('NEXT_PUBLIC_STABLE_DECIMALS') || '6');

// Mock Token for testing Token settlements (optional, has public mint function)
export const MOCK_TOKEN_ADDRESS = (process.env.NEXT_PUBLIC_MOCK_TOKEN || '') as `0x${string}`;

// ERC20 ABI (unchanged)
export const ERC20_ABI = [
  { "type": "function", "name": "approve", "inputs": [{ "name": "spender", "type": "address" }, { "name": "amount", "type": "uint256" }], "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "nonpayable" },
  { "type": "function", "name": "allowance", "inputs": [{ "name": "owner", "type": "address" }, { "name": "spender", "type": "address" }], "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view" },
  { "type": "function", "name": "balanceOf", "inputs": [{ "name": "account", "type": "address" }], "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view" },
  { "type": "function", "name": "decimals", "inputs": [], "outputs": [{ "name": "", "type": "uint8" }], "stateMutability": "view" },
  { "type": "function", "name": "mint", "inputs": [{ "name": "to", "type": "address" }, { "name": "amount", "type": "uint256" }], "outputs": [], "stateMutability": "nonpayable" }
] as const;

// V4 ABIs imported from JSON files
export const ESCROW_ORDERBOOK_ABI = EscrowOrderBookV4ABI as const;
export const PROJECT_REGISTRY_ABI = ProjectRegistryV2ABI as const;

/**
 * Helper function to convert a slug to a projectId (bytes32)
 * This matches the on-chain getProjectId() function
 * @param slug The project slug (e.g., "lighter")
 * @returns The bytes32 project ID (keccak256 hash)
 */
export function slugToProjectId(slug: string): `0x${string}` {
  return keccak256(toBytes(slug));
}

/**
 * Legacy type for backward compatibility during migration
 * V2 used address as project identifier, V3 uses bytes32
 */
export type ProjectIdentifier = `0x${string}`; // Can be either address (V2) or bytes32 (V3)
