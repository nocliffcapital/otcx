/**
 * Multi-chain Configuration
 * Supports deployment across multiple EVM chains
 */

export type ChainConfig = {
  id: number;
  name: string;
  shortName: string;
  rpcUrl: string;
  orderbook: `0x${string}`;
  registry: `0x${string}`;
  stable: `0x${string}`;
  stableSymbol: string;
  stableDecimals: number;
  explorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  testnet: boolean;
  enabled: boolean;
};

export const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
  // ========== TESTNETS ==========
  
  sepolia: {
    id: 11155111,
    name: 'Sepolia Testnet',
    shortName: 'Sepolia',
    rpcUrl: process.env.NEXT_PUBLIC_SEPOLIA_RPC || 'https://sepolia.infura.io/v3/',
    orderbook: '0xe1aFcaDD4D10368e9C8939240581A00fba14E494', // V4 orderbook with Private Orders (FRESH DEPLOYMENT)
    registry: '0xa58F04C440CdE1E98Eb758DaeD01a285BA463E3d', // Fresh empty registry (ZERO PROJECTS)
    stable: '0xd5d56a9Cd59550c6D95569620F7eb89C1E4c9101',
    stableSymbol: 'USDC',
    stableDecimals: 6,
    explorer: 'https://sepolia.etherscan.io',
    nativeCurrency: {
      name: 'Sepolia ETH',
      symbol: 'ETH',
      decimals: 18,
    },
    testnet: true,
    enabled: true,
  },

  // ========== MAINNETS ==========
  
  arbitrum: {
    id: 42161,
    name: 'Arbitrum One',
    shortName: 'Arbitrum',
    rpcUrl: process.env.NEXT_PUBLIC_ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc',
    // TODO: Deploy and update these addresses
    orderbook: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    registry: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    stable: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC Native
    stableSymbol: 'USDC',
    stableDecimals: 6,
    explorer: 'https://arbiscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    testnet: false,
    enabled: false, // Enable after deployment
  },

  base: {
    id: 8453,
    name: 'Base',
    shortName: 'Base',
    rpcUrl: process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org',
    // TODO: Deploy and update these addresses
    orderbook: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    registry: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    stable: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC Native
    stableSymbol: 'USDC',
    stableDecimals: 6,
    explorer: 'https://basescan.org',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    testnet: false,
    enabled: false, // Enable after deployment
  },

  optimism: {
    id: 10,
    name: 'Optimism',
    shortName: 'Optimism',
    rpcUrl: process.env.NEXT_PUBLIC_OPTIMISM_RPC || 'https://mainnet.optimism.io',
    // TODO: Deploy and update these addresses
    orderbook: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    registry: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    stable: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // USDC Native
    stableSymbol: 'USDC',
    stableDecimals: 6,
    explorer: 'https://optimistic.etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    testnet: false,
    enabled: false, // Enable after deployment
  },

  polygon: {
    id: 137,
    name: 'Polygon',
    shortName: 'Polygon',
    rpcUrl: process.env.NEXT_PUBLIC_POLYGON_RPC || 'https://polygon-rpc.com',
    // TODO: Deploy and update these addresses
    orderbook: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    registry: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    stable: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // USDC Native
    stableSymbol: 'USDC',
    stableDecimals: 6,
    explorer: 'https://polygonscan.com',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
    testnet: false,
    enabled: false, // Enable after deployment
  },

  ethereum: {
    id: 1,
    name: 'Ethereum',
    shortName: 'Ethereum',
    rpcUrl: process.env.NEXT_PUBLIC_ETHEREUM_RPC || 'https://eth.llamarpc.com',
    // TODO: Deploy and update these addresses
    orderbook: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    registry: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    stable: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    stableSymbol: 'USDC',
    stableDecimals: 6,
    explorer: 'https://etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    testnet: false,
    enabled: false, // Enable after deployment
  },
};

/**
 * Get chain configuration by chain ID
 */
export function getChainConfig(chainId: number): ChainConfig {
  const chain = Object.values(SUPPORTED_CHAINS).find(c => c.id === chainId);
  if (!chain) {
    // Default to Sepolia if chain not found
    return SUPPORTED_CHAINS.sepolia;
  }
  return chain;
}

/**
 * Get all enabled chains
 */
export function getEnabledChains(): ChainConfig[] {
  return Object.values(SUPPORTED_CHAINS).filter(c => c.enabled);
}

/**
 * Get chain name by ID
 */
export function getChainName(chainId: number): string {
  const chain = getChainConfig(chainId);
  return chain.shortName;
}

/**
 * Check if chain is supported
 */
export function isChainSupported(chainId: number): boolean {
  const chain = Object.values(SUPPORTED_CHAINS).find(c => c.id === chainId);
  return chain !== undefined && chain.enabled;
}

/**
 * Get explorer URL for address
 */
export function getExplorerUrl(chainId: number, address: string, type: 'address' | 'tx' = 'address'): string {
  const chain = getChainConfig(chainId);
  return `${chain.explorer}/${type}/${address}`;
}

/**
 * Format chain-specific block explorer link
 */
export function getBlockExplorerName(chainId: number): string {
  const chain = getChainConfig(chainId);
  if (chain.id === 42161) return 'Arbiscan';
  if (chain.id === 8453) return 'Basescan';
  if (chain.id === 10) return 'Optimism Explorer';
  if (chain.id === 137) return 'Polygonscan';
  if (chain.id === 1) return 'Etherscan';
  return 'Block Explorer';
}

/**
 * Get default chain (for initial load)
 */
export function getDefaultChain(): ChainConfig {
  // Return first enabled chain (Sepolia by default)
  return getEnabledChains()[0] || SUPPORTED_CHAINS.sepolia;
}

