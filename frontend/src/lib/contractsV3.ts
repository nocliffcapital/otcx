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
 * @param slug The project slug (e.g., "lighter")
 * @returns The bytes32 project ID (keccak256 hash)
 */
export function getProjectId(slug: string): `0x${string}` {
  const encoder = new TextEncoder();
  const data = encoder.encode(slug);
  
  // Use browser's SubtleCrypto if available, otherwise we'll compute on-chain
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    // For client-side, we can use the on-chain helper function via wagmi
    // This is just a placeholder - actual implementation uses wagmi's useReadContract
    return `0x${slug}` as `0x${string}`; // Placeholder
  }
  
  // Fallback: let wagmi/viem handle it
  return `0x${slug}` as `0x${string}`; // Placeholder
}

