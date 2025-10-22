"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProjectImage } from "@/components/ProjectImage";
import { useMyOrders } from "@/hooks/useOrders";
import { useOrderbook } from "@/hooks/useOrderbook";
import { useToast } from "@/components/Toast";
import ReputationBadge from "@/components/ReputationBadge";
import { TGEOrderControls } from "@/components/TGEOrderControls";
import { formatUnits } from "viem";
import { STABLE_DECIMALS, REGISTRY_ADDRESS, PROJECT_REGISTRY_ABI } from "@/lib/contracts";
import { useState, useEffect, useMemo } from "react";
import { useReadContract, usePublicClient } from "wagmi";
import { FileText, TrendingUp, Clock, CheckCircle2, Lock, DollarSign, ArrowUpRight, ArrowDownRight } from "lucide-react";

const STATUS_LABELS = [
  "OPEN",            // 0
  "FUNDED",          // 1
  "TGE ACTIVATED",   // 2
  "TOKENS DEPOSITED",// 3
  "SETTLED",         // 4
  "DEFAULTED",       // 5
  "CANCELED",        // 6
  "EXPIRED"          // 7
];
const STATUS_COLORS = [
  "bg-orange-500",   // OPEN
  "bg-blue-500",     // FUNDED
  "bg-violet-600",   // TGE_ACTIVATED
  "bg-purple-600",   // TOKENS_DEPOSITED
  "bg-emerald-600",  // SETTLED
  "bg-red-700",      // DEFAULTED
  "bg-gray-600",     // CANCELED
  "bg-red-600"       // EXPIRED
];

export default function MyOrdersPage() {
  const { address, cancel, takeSellOrder, takeBuyOrder } = useOrderbook();
  const { orders, loading, refresh } = useMyOrders(address);
  const toast = useToast();
  const [canceling, setCanceling] = useState<string | null>(null);
  const [locking, setLocking] = useState<string | null>(null);
  const [projectNames, setProjectNames] = useState<Record<string, string>>({});
  const [projectMetadata, setProjectMetadata] = useState<Record<string, string>>({}); // token address -> metadataURI
  const [showCanceled, setShowCanceled] = useState(false);

  const publicClient = usePublicClient();

  // Fetch all projects to map token addresses to names and metadata URIs
  const { data: projects } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: PROJECT_REGISTRY_ABI,
    functionName: "getActiveProjects",
  });

  // V3: Map projectId (bytes32) -> name and metadataURI
  // Orders store projectId in the projectToken field (confusing naming from V2)
  useEffect(() => {
    if (!projects) return;
    
    const nameMap: Record<string, string> = {};
    const metadataMap: Record<string, string> = {};
    
    // V3: getActiveProjects returns full structs with metadataURI
    for (const proj of projects as Array<{ id: string; name: string; metadataURI: string }>) {
      try {
        // V3: projectId (bytes32) is stored in proj.id
        nameMap[proj.id.toLowerCase()] = proj.name;
        metadataMap[proj.id.toLowerCase()] = proj.metadataURI || '';
      } catch (error) {
        console.error(`Failed to process project ${proj.name}:`, error);
      }
    }
    
    setProjectNames(nameMap);
    setProjectMetadata(metadataMap);
  }, [projects]);

  // Filter orders based on showCanceled toggle
  const filteredOrders = useMemo(() => {
    if (showCanceled) return orders;
    return orders.filter(o => o.status !== 6); // Exclude CANCELED (status 6)
  }, [orders, showCanceled]);

  // Calculate summary stats (always based on all orders)
  const stats = useMemo(() => {
    // In Settlement: only TGE_ACTIVATED (2) or TOKENS_DEPOSITED (3)
    const inSettlement = orders.filter(o => o.status === 2 || o.status === 3).length;

    const active = orders.filter(o => o.status === 0).length; // OPEN
    const funded = orders.filter(o => o.status === 1).length; // FUNDED
    const settled = orders.filter(o => o.status === 4).length; // SETTLED
    const canceled = orders.filter(o => o.status === 6).length; // CANCELED

    // Calculate total volume (sum of all order values in USDC)
    const totalVolume = orders.reduce((sum, order) => {
      const orderValue = (order.amount * order.unitPrice) / BigInt(10 ** 18); // Convert to USDC decimals
      return sum + Number(formatUnits(orderValue, STABLE_DECIMALS));
    }, 0);

    // Buy vs Sell breakdown
    const buyOrders = orders.filter(o => !o.isSell).length;
    const sellOrders = orders.filter(o => o.isSell).length;

    // Calculate average order size
    const avgOrderSize = orders.length > 0 ? totalVolume / orders.length : 0;

    return { 
      inSettlement, 
      active, 
      funded, 
      settled, 
      canceled, 
      total: orders.length,
      totalVolume,
      buyOrders,
      sellOrders,
      avgOrderSize
    };
  }, [orders]);

  const handleCancel = async (orderId: bigint) => {
    try {
      setCanceling(orderId.toString());
      await cancel(orderId);
      toast.success(
        "Order canceled successfully!",
        "Your order has been removed from the orderbook."
      );
      // Refresh orders immediately after canceling
      setTimeout(() => refresh(), 2000); // Wait 2s for blockchain to update
    } catch (error) {
      console.error(error);
      toast.error(
        "Cancellation failed",
        error?.message || "Unable to cancel order. Please try again."
      );
    } finally {
      setCanceling(null);
    }
  };

  const handleLockCollateral = async (order: { id: bigint; isSell: boolean; amount: bigint; unitPrice: bigint }) => {
    try {
      setLocking(order.id.toString());
      // Convert from 24 decimals to 6 decimals (USDC)
      // amount is 18 decimals, unitPrice is 6 decimals, so divide by 10^18
      const total = (order.amount * order.unitPrice) / BigInt(10 ** 18);
      
      toast.info("⏳ Locking collateral...", "Transaction pending");
      
      if (order.isSell) {
        // I'm the seller, need to lock seller collateral
        await takeSellOrder(order.id, total);
      } else {
        // I'm the buyer, need to lock buyer funds
        await takeBuyOrder(order.id, total);
      }
      
      toast.success(
        "Collateral locked successfully!",
        "Your order is now fully funded."
      );
      setTimeout(() => refresh(), 2000);
    } catch (error) {
      console.error(error);
      toast.error(
        "Failed to lock collateral",
        error?.message || "Unable to lock collateral. Please try again."
      );
    } finally {
      setLocking(null);
    }
  };

  return (
    <div className="relative min-h-screen">
      {/* Corner accents */}
      <div className="fixed top-16 left-0 w-24 h-24 border-t-2 border-l-2 border-cyan-500/20 pointer-events-none"></div>
      <div className="fixed top-16 right-0 w-24 h-24 border-t-2 border-r-2 border-violet-500/20 pointer-events-none"></div>

      <div className="relative mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-3 bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
          Dashboard
        </h1>
        <p className="text-zinc-400 mb-8">Track and manage all your OTC orders</p>

        {/* Summary Stats */}
        {address && !loading && orders.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
            {/* Total Orders */}
            <Card className="p-4 border-cyan-500/30 bg-cyan-950/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-500/20 rounded-lg">
                  <FileText className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-cyan-400">{stats.total}</div>
                  <div className="text-xs text-zinc-400">Total Orders</div>
                </div>
              </div>
            </Card>
            
            {/* Total Volume */}
            <Card className="p-4 border-violet-500/30 bg-violet-950/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-500/20 rounded-lg">
                  <DollarSign className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-violet-400">
                    ${stats.totalVolume.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-xs text-zinc-400">Total Volume</div>
                </div>
              </div>
            </Card>

            {/* Buy Orders */}
            <Card className="p-4 border-green-500/30 bg-green-950/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <ArrowUpRight className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-400">{stats.buyOrders}</div>
                  <div className="text-xs text-zinc-400">Buy Orders</div>
                </div>
              </div>
            </Card>

            {/* Sell Orders */}
            <Card className="p-4 border-red-500/30 bg-red-950/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <ArrowDownRight className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-400">{stats.sellOrders}</div>
                  <div className="text-xs text-zinc-400">Sell Orders</div>
                </div>
              </div>
            </Card>
            
            {/* Active Orders */}
            <Card className="p-4 border-orange-500/30 bg-orange-950/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <Clock className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-400">{stats.active}</div>
                  <div className="text-xs text-zinc-400">Active</div>
                </div>
              </div>
            </Card>
            
            {/* In Settlement */}
            <Card className="p-4 border-blue-500/30 bg-blue-950/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-400">{stats.inSettlement}</div>
                  <div className="text-xs text-zinc-400">Settlement</div>
                </div>
              </div>
            </Card>
            
            {/* Settled */}
            <Card className="p-4 border-emerald-500/30 bg-emerald-950/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-400">{stats.settled}</div>
                  <div className="text-xs text-zinc-400">Settled</div>
                </div>
              </div>
            </Card>
          </div>
        )}
      
        {!address && (
          <Card className="p-6 text-center">
            <p className="text-zinc-400">Connect your wallet to view your orders</p>
          </Card>
        )}

        {address && loading && (
          <Card className="p-6 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mb-4"></div>
            <p className="text-zinc-400">Loading your orders...</p>
          </Card>
        )}

        {address && !loading && orders.length === 0 && (
          <Card className="p-6 text-center">
            <p className="text-zinc-400">You haven&apos;t created any orders yet</p>
          </Card>
        )}

        {/* Filter Controls */}
        {address && !loading && orders.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-zinc-400">
              Showing {filteredOrders.length} of {orders.length} orders
            </div>
            <button
              onClick={() => setShowCanceled(!showCanceled)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 transition-all text-sm"
            >
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                showCanceled 
                  ? 'bg-cyan-600 border-cyan-600' 
                  : 'border-zinc-600'
              }`}>
                {showCanceled && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-zinc-300">Include canceled orders</span>
              {stats.canceled > 0 && (
                <Badge className="bg-zinc-700 text-zinc-300 text-xs">
                  {stats.canceled}
                </Badge>
              )}
            </button>
          </div>
        )}

        <div className="space-y-3">
          {filteredOrders.map((order) => {
            // Calculate total in stable decimals (USD value)
            // amount is 18 decimals, unitPrice is 6 decimals, so divide by 10^18
            const total = (order.amount * order.unitPrice) / BigInt(10 ** 18);
            const hasSellerLock = order.sellerCollateral > 0n;
            const hasBuyerLock = order.buyerFunds > 0n;
            const canCancel = order.status === 0 && (
              (order.isSell && !hasBuyerLock) || 
              (!order.isSell && !hasSellerLock)
            );
            // Note: GTC orders don't expire
            const isInSettlement = order.status === 2 || order.status === 3; // TGE_ACTIVATED or TOKENS_DEPOSITED
            
            // Determine user's role in this order
            const iAmSeller = order.seller.toLowerCase() === address?.toLowerCase();
            const iAmBuyer = order.buyer.toLowerCase() === address?.toLowerCase();

            return (
              <Card key={order.id.toString()} className="p-3 hover:border-amber-500/30 transition-all">
                <div className="flex gap-3">
                  {/* Project Icon */}
                  <ProjectImage 
                    metadataURI={projectMetadata[order.projectToken.toLowerCase()]}
                    imageType="icon"
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0 border-2 border-zinc-700"
                    fallbackText={(projectNames[order.projectToken.toLowerCase()] || "?").charAt(0).toUpperCase()}
                  />
                  
                  <div className="flex-1 min-w-0 flex flex-col md:flex-row justify-between gap-3">
                    {/* Left: Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge className={order.isSell ? "bg-red-600 text-xs" : "bg-green-600 text-xs"}>
                          {order.isSell ? "SELL" : "BUY"}
                        </Badge>
                      {isInSettlement && (
                        <>
                          <Badge className="bg-orange-600 text-xs">TGE ACTIVATED</Badge>
                          {order.settlementDeadline > 0n && (() => {
                            const deadline = Number(order.settlementDeadline) * 1000;
                            const now = Date.now();
                            const remaining = deadline - now;
                            if (remaining > 0) {
                              const hours = Math.floor(remaining / (1000 * 60 * 60));
                              const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
                              return (
                                <Badge className="bg-red-600 text-xs">
                                  ⏰ {hours}h {minutes}m left
                                </Badge>
                              );
                            }
                            return null;
                          })()}
                        </>
                      )}
                      {!isInSettlement && (
                        <Badge className={`${STATUS_COLORS[order.status]} text-xs`}>
                          {STATUS_LABELS[order.status]}
                        </Badge>
                      )}
                      <span className="text-xs text-zinc-400 ml-2">
                        {projectNames[order.projectToken.toLowerCase()] || "Unknown Project"}
                      </span>
                      {/* Show counterparty reputation if order is funded */}
                      {(hasBuyerLock || hasSellerLock) && (
                        <>
                          <span className="text-xs text-zinc-500 ml-2">•</span>
                          <span className="text-xs text-zinc-500">
                            {order.isSell ? "Buyer:" : "Seller:"}
                          </span>
                          <ReputationBadge 
                            address={order.isSell ? order.buyer : order.seller} 
                            variant="compact" 
                          />
                        </>
                      )}
                    </div>

                    <div className="flex items-baseline gap-3 flex-wrap text-xs mb-2">
                      <div>
                        <span className="text-zinc-500">Amount: </span>
                        <span className="font-medium text-white">{formatUnits(order.amount, 18)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">@ </span>
                        <span className="font-medium text-cyan-400">${formatUnits(order.unitPrice, STABLE_DECIMALS)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">Total: </span>
                        <span className="font-semibold text-white">${formatUnits(total, STABLE_DECIMALS)}</span>
                      </div>
                    </div>

                    {/* Visual Timeline - Compact */}
                    <div className="flex items-center gap-1.5 mt-2">
                      <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                        order.status >= 0 ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-600'
                      }`}>
                        1
                      </div>
                      <div className={`h-0.5 w-6 ${order.status >= 1 ? 'bg-blue-500' : 'bg-zinc-800'}`}></div>
                      
                      <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                        order.status >= 1 ? 'bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-600'
                      }`}>
                        2
                      </div>
                      <div className={`h-0.5 w-6 ${order.status >= 2 ? 'bg-violet-600' : 'bg-zinc-800'}`}></div>
                      
                      <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                        order.status >= 2 ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-600'
                      }`}>
                        3
                      </div>
                      <div className={`h-0.5 w-6 ${order.status >= 4 ? 'bg-emerald-600' : 'bg-zinc-800'}`}></div>
                      
                      <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                        order.status === 4 ? 'bg-emerald-600 text-white' : 
                        order.status === 5 ? 'bg-red-700 text-white' : 
                        order.status === 6 ? 'bg-gray-600 text-white' : 
                        'bg-zinc-800 text-zinc-600'
                      }`}>
                        {order.status === 4 ? '✓' : order.status === 5 ? '✗' : order.status === 6 ? 'C' : '4'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[9px] text-zinc-500">
                      <span className="w-7 text-center">Open</span>
                      <span className="w-8"></span>
                      <span className="w-7 text-center">Lock</span>
                      <span className="w-8"></span>
                      <span className="w-7 text-center">TGE</span>
                      <span className="w-8"></span>
                      <span className="w-7 text-center">Done</span>
                    </div>
                  </div>

                  {/* Right: Escrow status + Action buttons */}
                  <div className="flex flex-col justify-between gap-2">
                    {/* Escrow status badges - top right */}
                    <div className="flex items-center gap-2 text-xs justify-end">
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500 text-[10px]">
                          {iAmSeller ? "You (Seller):" : "Seller:"}
                        </span>
                        {hasSellerLock ? (
                          <Badge className="bg-green-600/20 text-green-400 border border-green-500/30 text-xs px-2 py-0.5">
                            ✓ Locked
                          </Badge>
                        ) : (
                          <Badge className="bg-zinc-800 text-zinc-400 text-xs px-2 py-0.5">
                            ○ Pending
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500 text-[10px]">
                          {iAmBuyer ? "You (Buyer):" : "Buyer:"}
                        </span>
                        {hasBuyerLock ? (
                          <Badge className="bg-green-600/20 text-green-400 border border-green-500/30 text-xs px-2 py-0.5">
                            ✓ Locked
                          </Badge>
                        ) : (
                          <Badge className="bg-zinc-800 text-zinc-400 text-xs px-2 py-0.5">
                            ○ Pending
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Action buttons - bottom right */}
                    <div className="flex flex-row gap-2 justify-end items-end">
                      {/* Settlement Controls for TGE_ACTIVATED orders - INLINE RIGHT */}
                      {isInSettlement && (
                        <TGEOrderControls order={order} isOwner={false} />
                      )}
                      
                      {/* Show "Lock Collateral" for unfunded OPEN orders */}
                      {order.status === 0 && (
                        (order.isSell && !hasSellerLock) || (!order.isSell && !hasBuyerLock)
                      ) && (
                        <Button
                          size="sm"
                          variant="custom"
                          onClick={() => handleLockCollateral(order)}
                          disabled={!!locking}
                          className="bg-cyan-600 hover:bg-cyan-700 text-xs px-3 py-1 whitespace-nowrap h-7"
                        >
                          <Lock className="w-3 h-3 mr-1 inline" />
                          {locking === order.id.toString() ? "Locking..." : "Lock Collateral"}
                        </Button>
                      )}
                      
                      {/* Show "Cancel" for unfunded OPEN orders */}
                      {canCancel && (
                        <Button
                          size="sm"
                          variant="custom"
                          onClick={() => handleCancel(order.id)}
                          disabled={!!canceling}
                          className="bg-red-600 hover:bg-red-700 text-xs px-3 py-1 h-7"
                        >
                          {canceling === order.id.toString() ? "Canceling..." : "Cancel"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
