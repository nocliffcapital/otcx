"use client";

import { useAccount, useBalance, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { STABLE_ADDRESS, ERC20_ABI } from "@/lib/contracts";

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
    <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900/50 rounded-lg border border-zinc-800/50">
      {/* ETH Balance */}
      <div className="flex items-center gap-1.5">
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-[10px] font-bold">
          Ξ
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-zinc-500 leading-none">ETH</span>
          <span className="text-xs font-semibold text-zinc-200 leading-tight">
            {ethAmount.toFixed(4)}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-zinc-800"></div>

      {/* USDC Balance */}
      <div className="flex items-center gap-1.5">
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10" />
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-zinc-500 leading-none">USDC</span>
          <span className="text-xs font-semibold text-zinc-200 leading-tight">
            {usdcAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
}

