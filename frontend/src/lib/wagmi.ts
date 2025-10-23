"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http, createStorage, cookieStorage } from "wagmi";
import { sepolia, arbitrum, base, optimism, polygon, mainnet } from "wagmi/chains";

// RPC URLs (customize for production)
const sepoliaRpc = process.env.NEXT_PUBLIC_SEPOLIA_RPC || "https://ethereum-sepolia-rpc.publicnode.com";
const arbitrumRpc = process.env.NEXT_PUBLIC_ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc";
const baseRpc = process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org";
const optimismRpc = process.env.NEXT_PUBLIC_OPTIMISM_RPC || "https://mainnet.optimism.io";
const polygonRpc = process.env.NEXT_PUBLIC_POLYGON_RPC || "https://polygon-rpc.com";
const ethereumRpc = process.env.NEXT_PUBLIC_ETHEREUM_RPC || "https://eth.llamarpc.com";

export const wagmiConfig = getDefaultConfig({
  appName: "otcX",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "otcx-demo",
  
  // Add chains here - only enabled chains will show in RainbowKit
  // Start with Sepolia testnet, add mainnets when deployed
  chains: [
    sepolia,
    // Uncomment these when you deploy to mainnet:
    // arbitrum,
    // base,
    // optimism,
    // polygon,
    // mainnet, // Only for high-value trades
  ],
  
  transports: {
    [sepolia.id]: http(sepoliaRpc),
    // Uncomment these when you enable the chains above:
    // [arbitrum.id]: http(arbitrumRpc),
    // [base.id]: http(baseRpc),
    // [optimism.id]: http(optimismRpc),
    // [polygon.id]: http(polygonRpc),
    // [mainnet.id]: http(ethereumRpc),
  },
  
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});

