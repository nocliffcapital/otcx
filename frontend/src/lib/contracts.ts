/**
 * V3 Contract Configuration
 * 
 * Key Changes from V2:
 * - Uses bytes32 projectId instead of address (no fake addresses before TGE)
 * - Uses Solady for Ownable/ReentrancyGuard (gas optimized, battle-tested)
 * - Combines take+deposit into single transaction for better UX
 * - Auto-settles on token deposit (no manual claim step for buyer)
 * - Off-chain metadata storage (IPFS/Arweave) via metadataURI
 */

import ProjectRegistryV2ABI from './ProjectRegistryV2.abi.json';
import EscrowOrderBookV3ABI from './EscrowOrderBookV3.abi.json';
import { keccak256, toBytes } from 'viem';

export const ORDERBOOK_ADDRESS = process.env.NEXT_PUBLIC_ORDERBOOK as `0x${string}`;
export const STABLE_ADDRESS = process.env.NEXT_PUBLIC_STABLE as `0x${string}`;
export const STABLE_DECIMALS = Number(process.env.NEXT_PUBLIC_STABLE_DECIMALS || 6);
export const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_REGISTRY as `0x${string}`;

// ERC20 ABI (unchanged)
export const ERC20_ABI = [
  { "type": "function", "name": "approve", "inputs": [{ "name": "spender", "type": "address" }, { "name": "amount", "type": "uint256" }], "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "nonpayable" },
  { "type": "function", "name": "allowance", "inputs": [{ "name": "owner", "type": "address" }, { "name": "spender", "type": "address" }], "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view" },
  { "type": "function", "name": "balanceOf", "inputs": [{ "name": "account", "type": "address" }], "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view" },
  { "type": "function", "name": "decimals", "inputs": [], "outputs": [{ "name": "", "type": "uint8" }], "stateMutability": "view" },
  { "type": "function", "name": "mint", "inputs": [{ "name": "to", "type": "address" }, { "name": "amount", "type": "uint256" }], "outputs": [], "stateMutability": "nonpayable" }
] as const;

// V3 ABIs imported from JSON files
export const ESCROW_ORDERBOOK_ABI = EscrowOrderBookV3ABI as const;
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
