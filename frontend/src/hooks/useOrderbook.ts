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

  const checkBalance = useCallback(
    async (owner: Address) => {
      if (!publicClient) return 0n;
      return publicClient.readContract({
        address: STABLE_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [owner],
      }) as Promise<bigint>;
    },
    [publicClient]
  );

  /**
   * V4: Create sell order with bytes32 projectId
   * Collateral is locked in same transaction
   */
  const createSellOrder = useCallback(
    async ({ amount, unitPrice, projectId }: { amount: bigint; unitPrice: bigint; projectId: `0x${string}` }) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");
      
      // Convert from 24 decimals to 6 decimals (USDC)
      const total = (amount * unitPrice) / BigInt(10 ** 18);
      
      // Seller needs 100% collateral (same as buyer)
      const collateral = total;
      
      // Check balance first
      const balance = await checkBalance(address);
      if (balance < collateral) {
        throw new Error(`Insufficient USDC balance. You need ${(Number(collateral) / 1e6).toFixed(2)} USDC collateral but only have ${(Number(balance) / 1e6).toFixed(2)} USDC.`);
      }
      
      // Check and approve if needed (need approval for collateral)
      const allowance = await checkAllowance(address);
      if (allowance < collateral) {
        await approveStable(collateral * 2n);
      }

      // Get current nextId before creating order
      const nextIdBefore = await publicClient?.readContract({
        address: ORDERBOOK_ADDRESS,
        abi: ESCROW_ORDERBOOK_ABI,
        functionName: "nextId",
      }) as bigint;
      
      // V4: Create PUBLIC order (allowedTaker = address(0))
      const createHash = await walletClient.writeContract({
        address: ORDERBOOK_ADDRESS,
        abi: ESCROW_ORDERBOOK_ABI,
        functionName: "createOrder",
        args: [projectId, amount, unitPrice, true, "0x0000000000000000000000000000000000000000"], // isSell = true, public order
      });
      await publicClient?.waitForTransactionReceipt({ hash: createHash });
      
      const orderId = nextIdBefore;
      console.log('Created sell order ID:', orderId.toString());

      return { orderId, createHash };
    },
    [walletClient, publicClient, address, checkAllowance, checkBalance, approveStable]
  );

  /**
   * V4: Create buy order with bytes32 projectId
   * Funds are locked in same transaction
   */
  const createBuyOrder = useCallback(
    async ({ amount, unitPrice, projectId }: { amount: bigint; unitPrice: bigint; projectId: `0x${string}` }) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");
      
      // Convert from 24 decimals to 6 decimals (USDC)
      const total = (amount * unitPrice) / BigInt(10 ** 18);
      
      // Check balance first
      const balance = await checkBalance(address);
      if (balance < total) {
        throw new Error(`Insufficient USDC balance. You need ${(Number(total) / 1e6).toFixed(2)} USDC but only have ${(Number(balance) / 1e6).toFixed(2)} USDC.`);
      }
      
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
      
      // V4: Create PUBLIC order (allowedTaker = address(0))
      const createHash = await walletClient.writeContract({
        address: ORDERBOOK_ADDRESS,
        abi: ESCROW_ORDERBOOK_ABI,
        functionName: "createOrder",
        args: [projectId, amount, unitPrice, false, "0x0000000000000000000000000000000000000000"], // isSell = false, public order
      });
      await publicClient?.waitForTransactionReceipt({ hash: createHash });
      
      const orderId = nextIdBefore;
      console.log('Created buy order ID:', orderId.toString());

      return { orderId, createHash };
    },
    [walletClient, publicClient, address, checkAllowance, checkBalance, approveStable]
  );

  /**
   * V4: Create private order (with allowedTaker)
   * Collateral/funds locked in same transaction
   */
  const createPrivateOrder = useCallback(
    async ({ 
      amount, 
      unitPrice, 
      projectId, 
      isSell,
      allowedTaker 
    }: { 
      amount: bigint; 
      unitPrice: bigint; 
      projectId: `0x${string}`; 
      isSell: boolean;
      allowedTaker: `0x${string}`;
    }) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");
      
      // Convert from 24 decimals to 6 decimals (USDC)
      const total = (amount * unitPrice) / BigInt(10 ** 18);
      const collateral = isSell ? total : (total * 110n) / 100n; // Sell: 100%, Buy: 110%
      
      // Check balance first
      const balance = await checkBalance(address);
      if (balance < collateral) {
        throw new Error(`Insufficient USDC balance. You need ${(Number(collateral) / 1e6).toFixed(2)} USDC but only have ${(Number(balance) / 1e6).toFixed(2)} USDC.`);
      }
      
      // Check and approve if needed
      const allowance = await checkAllowance(address);
      if (allowance < collateral) {
        await approveStable(collateral * 2n);
      }

      // Get current nextId before creating order
      const nextIdBefore = await publicClient?.readContract({
        address: ORDERBOOK_ADDRESS,
        abi: ESCROW_ORDERBOOK_ABI,
        functionName: "nextId",
      }) as bigint;
      
      // V4: Create private order
      const createHash = await walletClient.writeContract({
        address: ORDERBOOK_ADDRESS,
        abi: ESCROW_ORDERBOOK_ABI,
        functionName: "createOrder",
        args: [projectId, amount, unitPrice, isSell, allowedTaker],
      });
      await publicClient?.waitForTransactionReceipt({ hash: createHash });
      
      const orderId = nextIdBefore;
      console.log('Created private order ID:', orderId.toString());

      return { orderId, createHash };
    },
    [walletClient, publicClient, address, checkAllowance, checkBalance, approveStable]
  );

  /**
   * V4: Take sell order (automatically deposits buyer funds in same transaction)
   * Unified takeOrder function handles both sell and buy orders
   */
  const takeSellOrder = useCallback(
    async (orderId: bigint, total: bigint) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");
      
      const allowance = await checkAllowance(address);
      if (allowance < total) {
        await approveStable(total * 2n);
      }

      // V4: Take order (auto-deposits funds in same transaction)
      const hash = await walletClient.writeContract({
        address: ORDERBOOK_ADDRESS,
        abi: ESCROW_ORDERBOOK_ABI,
        functionName: "takeOrder",
        args: [orderId],
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      
      return hash;
    },
    [walletClient, publicClient, address, checkAllowance, approveStable]
  );

  /**
   * V4: Take buy order (automatically deposits seller collateral in same transaction)
   * Unified takeOrder function handles both sell and buy orders
   */
  const takeBuyOrder = useCallback(
    async (orderId: bigint, total: bigint) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");
      
      const allowance = await checkAllowance(address);
      if (allowance < total) {
        await approveStable(total * 2n);
      }

      // V4: Take order (auto-deposits collateral in same transaction)
      const hash = await walletClient.writeContract({
        address: ORDERBOOK_ADDRESS,
        abi: ESCROW_ORDERBOOK_ABI,
        functionName: "takeOrder",
        args: [orderId],
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      
      return hash;
    },
    [walletClient, publicClient, address, checkAllowance, approveStable]
  );

  // V3: markFilled removed - settlement is automatic when tokens deposited

  const cancel = useCallback(
    async (orderId: bigint) => {
      if (!walletClient) throw new Error("Wallet not connected");
      const hash = await walletClient.writeContract({
        address: ORDERBOOK_ADDRESS,
        abi: ESCROW_ORDERBOOK_ABI,
        functionName: "cancelOrder",
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

  /**
   * Get order details by ID
   */
  const getOrder = useCallback(
    async (orderId: bigint) => {
      if (!publicClient) return null;
      try {
        const order = await publicClient.readContract({
          address: ORDERBOOK_ADDRESS,
          abi: ESCROW_ORDERBOOK_ABI,
          functionName: "getOrder",
          args: [orderId],
        }) as any;
        return order;
      } catch (error) {
        console.error('Error fetching order:', error);
        return null;
      }
    },
    [publicClient]
  );

  /**
   * Get project details by ID
   */
  const getProjectById = useCallback(
    async (projectId: `0x${string}`) => {
      if (!publicClient) return null;
      try {
        const project = await publicClient.readContract({
          address: ORDERBOOK_ADDRESS,
          abi: ESCROW_ORDERBOOK_ABI,
          functionName: "getProjectById",
          args: [projectId],
        }) as any;
        return project;
      } catch (error) {
        console.error('Error fetching project:', error);
        return null;
      }
    },
    [publicClient]
  );

  /**
   * Generic takeOrder function (works for both buy and sell orders)
   */
  const takeOrder = useCallback(
    async (orderId: bigint) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");
      
      // Get order details to determine collateral needed
      const order = await getOrder(orderId);
      if (!order) throw new Error("Order not found");
      
      const total = (order.amount * order.unitPrice) / BigInt(10 ** 18);
      
      // Check and approve if needed
      const allowance = await checkAllowance(address);
      if (allowance < total) {
        await approveStable(total * 2n);
      }

      const hash = await walletClient.writeContract({
        address: ORDERBOOK_ADDRESS,
        abi: ESCROW_ORDERBOOK_ABI,
        functionName: "takeOrder",
        args: [orderId],
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      
      return hash;
    },
    [walletClient, publicClient, address, checkAllowance, approveStable, getOrder]
  );

  return { 
    address, 
    createSellOrder, 
    createBuyOrder,
    createPrivateOrder, 
    takeSellOrder, 
    takeBuyOrder,
    takeOrder,
    cancel,
    mintTestUSDC,
    mintTestTokens,
    approveStable,
    getOrder,
    getProjectById,
  };
}
