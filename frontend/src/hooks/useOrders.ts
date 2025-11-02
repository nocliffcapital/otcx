"use client";

import { useEffect, useState, useCallback } from "react";
import { usePublicClient } from "wagmi";
import { ESCROW_ORDERBOOK_ABI, ORDERBOOK_ADDRESS } from "@/lib/contracts";

// Type for raw order data from contract (V4 structure)
// V4: added allowedTaker field for private orders
type OrderDataTuple = readonly [bigint, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, bigint, bigint, bigint, bigint, bigint, boolean, `0x${string}`, number];

export interface Order {
  id: bigint;
  maker: string;
  buyer: string;
  seller: string;
  projectToken: string;
  amount: bigint;
  unitPrice: bigint;
  buyerFunds: bigint;
  sellerCollateral: bigint;
  settlementDeadline: bigint;
  isSell: boolean;
  allowedTaker: string; // V4: address(0) = public, specific address = private
  status: number;
  proof?: string; // For Points projects: seller submits proof of token transfer
  // Note: expiry removed - all orders are Good-Til-Cancel (GTC)
}

/**
 * V3: Hook to fetch orders for a specific project
 * @param projectId - bytes32 project identifier (keccak256 of slug)
 */
export function useOrders(projectId?: `0x${string}`) {
  const publicClient = usePublicClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]); // For chart - all historical orders
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!publicClient) return;

    let isInitialLoad = orders.length === 0;

    const fetchOrders = async () => {
      try {
        // Only show loading on initial load
        if (isInitialLoad) {
          setLoading(true);
        }
        
        // Alchemy free tier only allows 10 block range, so we'll fetch the nextId and query recent orders directly
        const nextId = await publicClient.readContract({
          address: ORDERBOOK_ADDRESS,
          abi: ESCROW_ORDERBOOK_ABI,
          functionName: "nextId",
        }) as bigint;
        
        console.log("Next order ID:", nextId.toString());
        
        // Fetch all orders by ID from 1 to nextId-1
        // Use Promise.all to batch requests for better performance
        const allOrdersList: Order[] = [];
        const orderPromises: Promise<void>[] = [];
        
        for (let i = 1n; i < nextId; i++) {
          const orderPromise = (async (orderId: bigint) => {
            try {
              const orderData = await publicClient.readContract({
                address: ORDERBOOK_ADDRESS,
                abi: ESCROW_ORDERBOOK_ABI,
                functionName: "orders",
                args: [orderId],
              }) as OrderDataTuple;

              // V4: Fetch proof for FUNDED orders (status 1) - they may have proofs submitted
              let proof: string | undefined = undefined;
              const status = orderData[12]; // V4: status is now at index 12
              if (status === 1) { // FUNDED status - check if proof exists
                try {
                  const proofData = await publicClient.readContract({
                    address: ORDERBOOK_ADDRESS,
                    abi: ESCROW_ORDERBOOK_ABI,
                    functionName: "settlementProof",
                    args: [orderId],
                  }) as string;
                  if (proofData && proofData.length > 0) {
                    proof = proofData;
                  }
                } catch {
                  // Proof might not exist, that's ok
                }
              }

              allOrdersList.push({
                id: orderData[0],
                maker: orderData[1],
                buyer: orderData[2],
                seller: orderData[3],
                projectToken: orderData[4], // V4: this is actually projectId (bytes32)
                amount: orderData[5],
                unitPrice: orderData[6],
                buyerFunds: orderData[7],
                sellerCollateral: orderData[8],
                settlementDeadline: orderData[9],
                isSell: orderData[10],
                allowedTaker: orderData[11], // V4: address(0) = public, specific address = private
                status: orderData[12], // V4: status is now at index 12
                proof,
              });
            } catch (err) {
              console.error(`Error fetching order ${orderId}:`, err);
            }
          })(i);
          
          orderPromises.push(orderPromise);
        }
        
        // Wait for all orders to be fetched
        await Promise.all(orderPromises);
        
        console.log('Fetched all orders:', allOrdersList);
        console.log('Filtering by projectId:', projectId);
        
        // Filter by projectToken for display
        // V3: Filter by projectId (bytes32) instead of projectToken (address)
        // Only show orders with collateral deposited (buyerFunds > 0 OR sellerCollateral > 0)
        const filtered = allOrdersList.filter(o => {
          console.log('Order projectToken:', o.projectToken, 'Comparing to projectId:', projectId);
          const matchesProject = !projectId || (typeof o.projectToken === 'string' && o.projectToken.toLowerCase() === projectId.toLowerCase());
          
          // Only show orders with collateral deposited
          const hasCollateral = o.isSell ? o.sellerCollateral > 0n : o.buyerFunds > 0n;
          const isAvailable = o.status === 0 && hasCollateral; // OPEN (0) with collateral
          
          console.log(`Order ${o.id}: matchesProject=${matchesProject}, status=${o.status}, hasCollateral=${hasCollateral}, isAvailable=${isAvailable}`);
          
          return isAvailable && matchesProject;
        });
        
        // Filter all orders by projectId for chart (all statuses)
        const allFiltered = allOrdersList.filter(o => {
          return !projectId || (typeof o.projectToken === 'string' && o.projectToken.toLowerCase() === projectId.toLowerCase());
        });
        
        console.log('Filtered orders:', filtered);
        
        setOrders(filtered);
        setAllOrders(allFiltered);
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        if (isInitialLoad) {
          setLoading(false);
          isInitialLoad = false;
        }
      }
    };

    fetchOrders();
    
    // Refetch every 30 seconds
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [publicClient, projectId]);

  return { orders, allOrders, loading };
}

export function useMyOrders(address?: string) {
  const publicClient = usePublicClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (!publicClient || !address) return;

    let isInitialLoad = orders.length === 0;

    const fetchOrders = async () => {
      try {
        // Only show loading on initial load
        if (isInitialLoad) {
          setLoading(true);
        }
        
        const nextId = await publicClient.readContract({
          address: ORDERBOOK_ADDRESS,
          abi: ESCROW_ORDERBOOK_ABI,
          functionName: "nextId",
        }) as bigint;
        
        const allOrders: Order[] = [];
        const orderPromises: Promise<void>[] = [];
        
        for (let i = 1n; i < nextId; i++) {
          const orderPromise = (async (orderId: bigint) => {
            try {
              const orderData = await publicClient.readContract({
                address: ORDERBOOK_ADDRESS,
                abi: ESCROW_ORDERBOOK_ABI,
                functionName: "orders",
                args: [orderId],
              }) as any;

              // V4: Fetch proof for FUNDED orders (status 1) - they may have proofs submitted
              let proof: string | undefined = undefined;
              const status = orderData[12]; // V4: status is now at index 12
              if (status === 1) { // FUNDED status - check if proof exists
                try {
                  const proofData = await publicClient.readContract({
                    address: ORDERBOOK_ADDRESS,
                    abi: ESCROW_ORDERBOOK_ABI,
                    functionName: "settlementProof",
                    args: [orderId],
                  }) as string;
                  if (proofData && proofData.length > 0) {
                    proof = proofData;
                  }
                } catch {
                  // Proof might not exist, that's ok
                }
              }

              const order = {
                id: orderData[0],
                maker: orderData[1],
                buyer: orderData[2],
                seller: orderData[3],
                projectToken: orderData[4], // V4: this is actually projectId (bytes32)
                amount: orderData[5],
                unitPrice: orderData[6],
                buyerFunds: orderData[7],
                sellerCollateral: orderData[8],
                settlementDeadline: orderData[9],
                isSell: orderData[10],
                allowedTaker: orderData[11], // V4: address(0) = public, specific address = private
                status: orderData[12], // V4: status is now at index 12
                proof,
              };
              
              // Filter by maker, buyer, OR seller address (show all orders you're involved in)
              const lowerAddress = address?.toLowerCase();
              if (
                order.maker.toLowerCase() === lowerAddress ||
                order.buyer.toLowerCase() === lowerAddress ||
                order.seller.toLowerCase() === lowerAddress
              ) {
                allOrders.push(order);
              }
            } catch (err) {
              console.error(`Error fetching order ${orderId}:`, err);
            }
          })(i);
          
          orderPromises.push(orderPromise);
        }
        
        // Wait for all orders to be fetched
        await Promise.all(orderPromises);
        
        setOrders(allOrders);
      } catch (error) {
        console.error("Error fetching my orders:", error);
      } finally {
        if (isInitialLoad) {
          setLoading(false);
          isInitialLoad = false;
        }
      }
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [publicClient, address, refreshTrigger]);

  return { orders, loading, refresh };
}

