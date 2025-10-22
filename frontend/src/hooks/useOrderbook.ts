"use client";

import { useCallback } from "react";
import { Address, parseUnits } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { ESCROW_ORDERBOOK_ABI, ORDERBOOK_ADDRESS, ERC20_ABI, STABLE_ADDRESS } from "@/lib/contracts";

export function useOrderbook() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const approveStable = useCallback(
    async (amount: bigint) => {
      if (!walletClient) throw new Error("Wallet not connected");
      const hash = await walletClient.writeContract({
        address: STABLE_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [ORDERBOOK_ADDRESS, amount],
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      return hash;
    },
    [walletClient, publicClient]
  );

  const checkAllowance = useCallback(
    async (owner: Address) => {
      if (!publicClient) return 0n;
      return publicClient.readContract({
        address: STABLE_ADDRESS,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [owner, ORDERBOOK_ADDRESS],
      }) as Promise<bigint>;
    },
    [publicClient]
  );

  /**
   * V3: Create sell order with bytes32 projectId
   * Then immediately locks seller collateral
   */
  const createSellOrder = useCallback(
    async ({ amount, unitPrice, projectId }: { amount: bigint; unitPrice: bigint; projectId: `0x${string}` }) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");
      
      // Convert from 24 decimals to 6 decimals (USDC)
      const total = (amount * unitPrice) / BigInt(10 ** 18);
      
      // Check and approve if needed (need approval for collateral)
      const allowance = await checkAllowance(address);
      if (allowance < total) {
        await approveStable(total * 2n);
      }

      // Get current nextId before creating order
      const nextIdBefore = await publicClient?.readContract({
        address: ORDERBOOK_ADDRESS,
        abi: ESCROW_ORDERBOOK_ABI,
        functionName: "nextId",
      }) as bigint;
      
      // V3: Create order
      const createHash = await walletClient.writeContract({
        address: ORDERBOOK_ADDRESS,
        abi: ESCROW_ORDERBOOK_ABI,
        functionName: "createSellOrder",
        args: [amount, unitPrice, projectId],
      });
      await publicClient?.waitForTransactionReceipt({ hash: createHash });
      
      const orderId = nextIdBefore;
      console.log('Created sell order ID:', orderId.toString());

      // V3: Immediately lock seller collateral
      const lockHash = await walletClient.writeContract({
        address: ORDERBOOK_ADDRESS,
        abi: ESCROW_ORDERBOOK_ABI,
        functionName: "lockSellerCollateral",
        args: [orderId],
      });
      await publicClient?.waitForTransactionReceipt({ hash: lockHash });
      console.log('Locked seller collateral for order:', orderId.toString());

      return { orderId, createHash, lockHash };
    },
    [walletClient, publicClient, address, checkAllowance, approveStable]
  );

  /**
   * V3: Create buy order with bytes32 projectId
   * Then immediately locks buyer funds
   */
  const createBuyOrder = useCallback(
    async ({ amount, unitPrice, projectId }: { amount: bigint; unitPrice: bigint; projectId: `0x${string}` }) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");
      
      // Convert from 24 decimals to 6 decimals (USDC)
      const total = (amount * unitPrice) / BigInt(10 ** 18);
      
      // Check and approve if needed (need approval for funds)
      const allowance = await checkAllowance(address);
      if (allowance < total) {
        await approveStable(total * 2n);
      }

      // Get current nextId before creating order
      const nextIdBefore = await publicClient?.readContract({
        address: ORDERBOOK_ADDRESS,
        abi: ESCROW_ORDERBOOK_ABI,
        functionName: "nextId",
      }) as bigint;
      
      // V3: Create order
      const createHash = await walletClient.writeContract({
        address: ORDERBOOK_ADDRESS,
        abi: ESCROW_ORDERBOOK_ABI,
        functionName: "createBuyOrder",
        args: [amount, unitPrice, projectId],
      });
      await publicClient?.waitForTransactionReceipt({ hash: createHash });
      
      const orderId = nextIdBefore;
      console.log('Created buy order ID:', orderId.toString());

      // V3: Immediately lock buyer funds
      const lockHash = await walletClient.writeContract({
        address: ORDERBOOK_ADDRESS,
        abi: ESCROW_ORDERBOOK_ABI,
        functionName: "lockBuyerFunds",
        args: [orderId],
      });
      await publicClient?.waitForTransactionReceipt({ hash: lockHash });
      console.log('Locked buyer funds for order:', orderId.toString());

      return { orderId, createHash, lockHash };
    },
    [walletClient, publicClient, address, checkAllowance, approveStable]
  );

  /**
   * V3: Take sell order (automatically deposits buyer funds in same transaction)
   */
  const takeSellOrder = useCallback(
    async (orderId: bigint, total: bigint) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");
      
      const allowance = await checkAllowance(address);
      if (allowance < total) {
        await approveStable(total * 2n);
      }

      // V3: Take order (auto-deposits funds in same transaction)
      const hash = await walletClient.writeContract({
        address: ORDERBOOK_ADDRESS,
        abi: ESCROW_ORDERBOOK_ABI,
        functionName: "takeSellOrder",
        args: [orderId],
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      
      return hash;
    },
    [walletClient, publicClient, address, checkAllowance, approveStable]
  );

  /**
   * V3: Take buy order (automatically deposits seller collateral in same transaction)
   */
  const takeBuyOrder = useCallback(
    async (orderId: bigint, total: bigint) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");
      
      const allowance = await checkAllowance(address);
      if (allowance < total) {
        await approveStable(total * 2n);
      }

      // V3: Take order (auto-deposits collateral in same transaction)
      const hash = await walletClient.writeContract({
        address: ORDERBOOK_ADDRESS,
        abi: ESCROW_ORDERBOOK_ABI,
        functionName: "takeBuyOrder",
        args: [orderId],
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      
      return hash;
    },
    [walletClient, publicClient, address, checkAllowance, approveStable]
  );

  const markFilled = useCallback(
    async (orderId: bigint, beneficiary: Address) => {
      if (!walletClient) throw new Error("Wallet not connected");
      const hash = await walletClient.writeContract({
        address: ORDERBOOK_ADDRESS,
        abi: ESCROW_ORDERBOOK_ABI,
        functionName: "markFilled",
        args: [orderId, beneficiary],
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      return hash;
    },
    [walletClient, publicClient]
  );

  const cancel = useCallback(
    async (orderId: bigint) => {
      if (!walletClient) throw new Error("Wallet not connected");
      const hash = await walletClient.writeContract({
        address: ORDERBOOK_ADDRESS,
        abi: ESCROW_ORDERBOOK_ABI,
        functionName: "cancel",
        args: [orderId],
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      return hash;
    },
    [walletClient, publicClient]
  );

  const mintTestUSDC = useCallback(
    async (amount: bigint) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");
      const hash = await walletClient.writeContract({
        address: STABLE_ADDRESS,
        abi: ERC20_ABI,
        functionName: "mint",
        args: [address, amount],
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      return hash;
    },
    [walletClient, publicClient, address]
  );

  const mintTestTokens = useCallback(
    async (tokenAddress: Address, amount: bigint) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");
      const hash = await walletClient.writeContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "mint",
        args: [address, amount],
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      return hash;
    },
    [walletClient, publicClient, address]
  );

  return { 
    address, 
    createSellOrder, 
    createBuyOrder, 
    takeSellOrder, 
    takeBuyOrder, 
    markFilled, 
    cancel,
    mintTestUSDC,
    mintTestTokens,
    approveStable,
  };
}
