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
        <div className="w-4 h-4">
          <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="16" fill="#2775CA"/>
            <path d="M20.022 18.124c0-2.124-1.28-2.852-3.84-3.156-1.828-.243-2.193-.728-2.193-1.578 0-.85.61-1.396 1.828-1.396 1.097 0 1.707.364 2.011 1.275a.458.458 0 00.427.303h.975a.416.416 0 00.427-.425v-.06a3.04 3.04 0 00-2.743-2.489V9.142c0-.243-.183-.425-.487-.486h-.915c-.243 0-.426.182-.487.486v1.396c-1.829.242-2.986 1.456-2.986 2.974 0 2.002 1.218 2.791 3.778 3.095 1.707.303 2.255.668 2.255 1.639 0 .97-.853 1.638-2.011 1.638-1.585 0-2.133-.667-2.316-1.578-.061-.242-.244-.364-.427-.364h-1.036a.416.416 0 00-.426.425v.06c.243 1.518 1.219 2.61 3.23 2.914v1.457c0 .242.183.425.487.485h.915c.243 0 .426-.182.487-.485V21.34c1.829-.303 3.047-1.578 3.047-3.217z" fill="#fff"/>
          </svg>
        </div>
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

