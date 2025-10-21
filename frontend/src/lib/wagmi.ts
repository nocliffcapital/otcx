"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http, createStorage, cookieStorage } from "wagmi";
import { sepolia } from "wagmi/chains";

const rpcUrl = process.env.NEXT_PUBLIC_RPC || "https://rpc.ankr.com/eth_sepolia";

console.log('Using RPC URL:', rpcUrl);

export const wagmiConfig = getDefaultConfig({
  appName: "otcX",
  projectId: "otcx-demo", // can be any string with getDefaultConfig v1
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(rpcUrl),
  },
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});

