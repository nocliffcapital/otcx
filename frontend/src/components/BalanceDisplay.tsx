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
    <div className="flex items-center gap-3 px-4 py-2.5 bg-zinc-800/50 rounded-lg border border-zinc-800">
      {/* ETH Balance */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xs font-bold">
          Ξ
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-zinc-500 leading-none mb-0.5">ETH</span>
          <span className="text-sm font-semibold text-zinc-100 leading-none">
            {ethAmount.toFixed(4)}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-9 bg-zinc-700"></div>

      {/* USDC Balance */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10" />
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-zinc-500 leading-none mb-0.5">USDC</span>
          <span className="text-sm font-semibold text-zinc-100 leading-none">
            {usdcAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
}

