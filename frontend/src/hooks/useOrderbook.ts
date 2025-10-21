"use client";

import { useCallback } from "react";
import { Address, parseUnits } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { ESCROW_ORDERBOOK_ABI, ORDERBOOK_ADDRESS, ERC20_ABI, STABLE_ADDRESS, STABLE_DECIMALS } from "@/lib/contracts";

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

  const createSellOrder = useCallback(
    async ({ amount, unitPrice, projectToken }: { amount: bigint; unitPrice: bigint; projectToken: Address }) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");
      
      // Convert from 24 decimals to 6 decimals (USDC)
      // amount is 18 decimals, unitPrice is 6 decimals, so divide by 10^18
      const total = (amount * unitPrice) / BigInt(10 ** 18);
      
      // Check and approve if needed
      const allowance = await checkAllowance(address);
      if (allowance < total) {
        await approveStable(total * 2n); // Approve 2x for future orders
      }

      // Get current nextId before creating order
      const nextIdBefore = await publicClient?.readContract({
        address: ORDERBOOK_ADDRESS,
        abi: ESCROW_ORDERBOOK_ABI,
        functionName: "nextId",
      }) as bigint;
      
      // Create order
      const createHash = await walletClient.writeContract({
        address: ORDERBOOK_ADDRESS,
        abi: ESCROW_ORDERBOOK_ABI,
        functionName: "createSellOrder",
        args: [amount, unitPrice, projectToken],
      });
      await publicClient?.waitForTransactionReceipt({ hash: createHash });
      
      // The order ID is nextId - 1 (since nextId was incremented)
      const orderId = nextIdBefore;
      
      console.log('Created sell order ID:', orderId.toString());

      // Deposit seller collateral
      const depositHash = await walletClient.writeContract({
        address: ORDERBOOK_ADDRESS,
        abi: ESCROW_ORDERBOOK_ABI,
        functionName: "depositSellerCollateral",
        args: [orderId],
      });
      await publicClient?.waitForTransactionReceipt({ hash: depositHash });

      return { orderId, createHash, depositHash };
    },
    [walletClient, publicClient, address, checkAllowance, approveStable]
  );

  const createBuyOrder = useCallback(
    async ({ amount, unitPrice, projectToken }: { amount: bigint; unitPrice: bigint; projectToken: Address }) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");
      
      // Convert from 24 decimals to 6 decimals (USDC)
      // amount is 18 decimals, unitPrice is 6 decimals, so divide by 10^18
      const total = (amount * unitPrice) / BigInt(10 ** 18);
      
      // Check and approve if needed
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
      
      // Create order
      const createHash = await walletClient.writeContract({
        address: ORDERBOOK_ADDRESS,
        abi: ESCROW_ORDERBOOK_ABI,
        functionName: "createBuyOrder",
        args: [amount, unitPrice, projectToken],
      });
      await publicClient?.waitForTransactionReceipt({ hash: createHash });
      
      // The order ID is nextId - 1 (since nextId was incremented)
      const orderId = nextIdBefore;
      
      console.log('Created buy order ID:', orderId.toString());

      // Deposit buyer funds
      const depositHash = await walletClient.writeContract({
        address: ORDERBOOK_ADDRESS,
        abi: ESCROW_ORDERBOOK_ABI,
        functionName: "depositBuyerFunds",
        args: [orderId],
      });
      await publicClient?.waitForTransactionReceipt({ hash: depositHash });

      return { orderId, createHash, depositHash };
    },
    [walletClient, publicClient, address, checkAllowance, approveStable]
  );

  const takeSellOrder = useCallback(
    async (orderId: bigint, total: bigint) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");
      
      const allowance = await checkAllowance(address);
      if (allowance < total) {
        await approveStable(total * 2n);
      }

      // First, take the sell order (sets buyer = msg.sender)
      const takeHash = await walletClient.writeContract({
        address: ORDERBOOK_ADDRESS,
        abi: ESCROW_ORDERBOOK_ABI,
        functionName: "takeSellOrder",
        args: [orderId],
      });
      await publicClient?.waitForTransactionReceipt({ hash: takeHash });

      // Then, deposit buyer funds
      const depositHash = await walletClient.writeContract({
        address: ORDERBOOK_ADDRESS,
        abi: ESCROW_ORDERBOOK_ABI,
        functionName: "depositBuyerFunds",
        args: [orderId],
      });
      await publicClient?.waitForTransactionReceipt({ hash: depositHash });
      
      return depositHash;
    },
    [walletClient, publicClient, address, checkAllowance, approveStable]
  );

  const takeBuyOrder = useCallback(
    async (orderId: bigint, total: bigint) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");
      
      const allowance = await checkAllowance(address);
      if (allowance < total) {
        await approveStable(total * 2n);
      }

      // First, take the buy order (sets seller = msg.sender)
      const takeHash = await walletClient.writeContract({
        address: ORDERBOOK_ADDRESS,
        abi: ESCROW_ORDERBOOK_ABI,
        functionName: "takeBuyOrder",
        args: [orderId],
      });
      await publicClient?.waitForTransactionReceipt({ hash: takeHash });

      // Then, deposit seller collateral
      const depositHash = await walletClient.writeContract({
        address: ORDERBOOK_ADDRESS,
        abi: ESCROW_ORDERBOOK_ABI,
        functionName: "depositSellerCollateral",
        args: [orderId],
      });
      await publicClient?.waitForTransactionReceipt({ hash: depositHash });
      
      return depositHash;
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
