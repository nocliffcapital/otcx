"use client";

import { useAccount, useBalance, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { STABLE_ADDRESS, ERC20_ABI } from "@/lib/contracts";
import { UsdcIcon } from "./icons/UsdcIcon";

export function BalanceDisplay() {
  const { address, isConnected } = useAccount();

  // Get ETH balance
  const { data: ethBalance } = useBalance({
    address: address,
  });

  // Get USDC balance
  const { data: usdcBalance } = useReadContract({
    address: STABLE_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  if (!isConnected || !address) {
    return null;
  }

  const ethAmount = ethBalance ? parseFloat(formatUnits(ethBalance.value, 18)) : 0;
  const usdcAmount = usdcBalance ? parseFloat(formatUnits(usdcBalance as bigint, 6)) : 0;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/50 rounded-lg border border-zinc-800">
      {/* ETH Balance */}
      <div className="flex items-center gap-1.5">
        <div className="w-4 h-4">
          <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="16" fill="#627EEA"/>
            <path d="M16.498 4v8.87l7.497 3.35z" fill="#fff" fillOpacity=".602"/>
            <path d="M16.498 4L9 16.22l7.498-3.35z" fill="#fff"/>
            <path d="M16.498 21.968v6.027L24 17.616z" fill="#fff" fillOpacity=".602"/>
            <path d="M16.498 27.995v-6.028L9 17.616z" fill="#fff"/>
            <path d="M16.498 20.573l7.497-4.353-7.497-3.348z" fill="#fff" fillOpacity=".2"/>
            <path d="M9 16.22l7.498 4.353v-7.701z" fill="#fff" fillOpacity=".602"/>
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] text-zinc-500 leading-none">ETH</span>
          <span className="text-xs font-semibold text-zinc-100 leading-tight">
            {ethAmount.toFixed(4)}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-zinc-700"></div>

      {/* USDC Balance */}
      <div className="flex items-center gap-1.5">
        <UsdcIcon size={16} />
        <div className="flex flex-col">
          <span className="text-[9px] text-zinc-500 leading-none">USDC</span>
          <span className="text-xs font-semibold text-zinc-100 leading-tight">
            {usdcAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
}

