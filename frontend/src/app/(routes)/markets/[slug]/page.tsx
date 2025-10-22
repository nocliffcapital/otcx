"use client";

import { useState, use, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useOrderbook } from "@/hooks/useOrderbook";
import { useOrders } from "@/hooks/useOrders";
import { useToast } from "@/components/Toast";
import { ProjectImage } from "@/components/ProjectImage";
import { parseUnits, formatUnits } from "viem";
import { STABLE_DECIMALS, STABLE_ADDRESS, ERC20_ABI, REGISTRY_ADDRESS, PROJECT_REGISTRY_ABI, ORDERBOOK_ADDRESS, ESCROW_ORDERBOOK_ABI, slugToProjectId } from "@/lib/contracts";
import { useReadContract } from "wagmi";
import { PriceChart } from "@/components/PriceChart";
import { ProjectInfo } from "@/components/ProjectInfo";
import { TrendingUp, Calculator, ArrowUpCircle, ArrowDownCircle, LineChart, PlusCircle, MinusCircle, ShoppingCart, Package, CheckCircle } from "lucide-react";
import Link from "next/link";
import ReputationBadge from "@/components/ReputationBadge";
import ProjectReputationBadge from "@/components/ProjectReputationBadge";

export default function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { address, createSellOrder, createBuyOrder, takeSellOrder, takeBuyOrder, mintTestUSDC, mintTestTokens } = useOrderbook();
  const toast = useToast();
  
  // V3: Fetch project details from registry using slug
  const { data: project } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: PROJECT_REGISTRY_ABI,
    functionName: "getProjectBySlug",
    args: [slug],
  });
  
  // Check if user is orderbook owner (for TGE controls)
  const { data: orderbookOwner } = useReadContract({
    address: ORDERBOOK_ADDRESS,
    abi: ESCROW_ORDERBOOK_ABI,
    functionName: "owner",
  });

  // Check if orderbook is paused
  const { data: isPausedData } = useReadContract({
    address: ORDERBOOK_ADDRESS,
    abi: ESCROW_ORDERBOOK_ABI,
    functionName: "paused",
  });
  const isOrderbookPaused = isPausedData === true;
  
  // Fetch USDC balance
  const { data: usdcBalance } = useReadContract({
    address: STABLE_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 5000,
    },
  });
  
  // V3: Use projectId (bytes32) instead of tokenAddress
  const projectId = slugToProjectId(slug);
  const { orders, allOrders, loading } = useOrders(projectId);
  
  // Helper function to ensure URL has protocol
  const ensureHttps = (url: string | undefined) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `https://${url}`;
  };
  
  const [side, setSide] = useState<"SELL" | "BUY">("SELL");
  const [amount, setAmount] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);
  
  // V3: Fetch metadata from IPFS
  const [metadata, setMetadata] = useState<{
    description?: string;
    twitterUrl?: string;
    websiteUrl?: string;
    logoUrl?: string;
    iconUrl?: string;
  } | null>(null);
  
  useEffect(() => {
    const fetchMetadata = async () => {
      if (!project?.metadataURI) return;
      
      try {
        // Convert IPFS URI to HTTP gateway URL - try multiple gateways
        let httpUrl = project.metadataURI;
        if (project.metadataURI.startsWith('ipfs://')) {
          const cid = project.metadataURI.slice(7);
          httpUrl = `https://cf-ipfs.com/ipfs/${cid}`;
        }
        
        console.log('Fetching metadata from:', httpUrl);
        const response = await fetch(httpUrl);
        if (!response.ok) throw new Error(`Failed to fetch metadata: ${response.status}`);
        
        const data = await response.json();
        console.log('Fetched metadata:', data);
        setMetadata(data);
      } catch (error) {
        console.error('Error fetching project metadata:', error);
        setMetadata(null);
      }
    };
    
    fetchMetadata();
  }, [project?.metadataURI]);

  const total = Number(amount || 0) * Number(unitPrice || 0);

  // Filter orders: OPEN (0) orders for orderbook, FUNDED (1) for filled section
  // Debug logging
  console.log('All orders for project:', orders);
  console.log('Orders filtered by projectId:', projectId);
  
  const sellOrders = orders.filter(o => o.isSell && o.status === 0);
  const buyOrders = orders.filter(o => !o.isSell && o.status === 0);
  // V3: Filled orders = FUNDED (1), TGE_ACTIVATED (2), and SETTLED (3)
  // Use allOrders (not filtered by status) for filled orders section
  const filledOrders = allOrders.filter(o => o.status === 1 || o.status === 2 || o.status === 3).sort((a, b) => Number(b.id) - Number(a.id));
  
  console.log('Sell orders:', sellOrders);
  console.log('Buy orders:', buyOrders);

  // Find TGE-activated orders (status >= 2) to get settlement window
  const tgeActivatedOrders = orders.filter(o => o.status >= 2 && o.settlementDeadline > 0n);
  
  const settlementDeadline = tgeActivatedOrders.length > 0 
    ? Number(tgeActivatedOrders[0].settlementDeadline) * 1000 // Convert to milliseconds
    : null;
  
  // Settlement window is: [TGE activation time, deadline]
  // TGE activation time = deadline - 4 hours (14400 seconds)
  const settlementStartTime = settlementDeadline ? new Date(settlementDeadline - (4 * 60 * 60 * 1000)) : null;
  const settlementEndTime = settlementDeadline ? new Date(settlementDeadline) : null;

  // Calculate spread and last price
  const lowestAsk = sellOrders.length > 0 ? Number(formatUnits(sellOrders[0].unitPrice, STABLE_DECIMALS)) : null;
  const highestBid = buyOrders.length > 0 ? Number(formatUnits(buyOrders[0].unitPrice, STABLE_DECIMALS)) : null;
  const spread = lowestAsk && highestBid ? ((lowestAsk - highestBid) / highestBid * 100) : null;
  const midMarket = lowestAsk && highestBid ? (lowestAsk + highestBid) / 2 : null;
  
  // Last price from most recent filled order
  const lastPrice = filledOrders.length > 0 
    ? Number(formatUnits(filledOrders[0].unitPrice, STABLE_DECIMALS))
    : null;

  // Calculate max order size for depth visualization
  // amount is in 18 decimals, unitPrice is in 6 decimals, so total is in 24 decimals
  const maxBuyOrder = buyOrders.length > 0 ? Math.max(...buyOrders.map(o => Number(formatUnits(o.amount * o.unitPrice, 18 + STABLE_DECIMALS)))) : 0;
  const maxSellOrder = sellOrders.length > 0 ? Math.max(...sellOrders.map(o => Number(formatUnits(o.amount * o.unitPrice, 18 + STABLE_DECIMALS)))) : 0;

  const handleCreate = async () => {
    if (!amount || !unitPrice || !address) return;
    
    try {
      setCreating(true);
      // Token amounts use 18 decimals (standard ERC20)
      const amountBigInt = parseUnits(amount, 18); // Amount in token decimals (18)
      const priceBigInt = parseUnits(unitPrice, STABLE_DECIMALS); // Price in stable decimals (6 for USDC)

      // V3: Use projectId (bytes32) instead of projectToken (address)
      if (side === "SELL") {
        await createSellOrder({
          amount: amountBigInt,
          unitPrice: priceBigInt,
          projectId: projectId,
        });
      } else {
        await createBuyOrder({
          amount: amountBigInt,
          unitPrice: priceBigInt,
          projectId: projectId,
        });
      }

      // Reset form
      setAmount("");
      setUnitPrice("");
      toast.success(
        `${side} order created successfully!`,
        "Your Good-Til-Cancel order is now live in the orderbook"
      );
    } catch (error) {
      console.error(error);
      toast.error(
        "Transaction failed",
        error?.message || "Unable to create order. Please try again."
      );
    } finally {
      setCreating(false);
    }
  };

  const handleTakeSell = async (order: { id: bigint }) => {
    try {
      setActionLoading(order.id.toString());
      // Convert from 24 decimals to 6 decimals (USDC)
      // amount is 18 decimals, unitPrice is 6 decimals, so divide by 10^18
      const total = (order.amount * order.unitPrice) / BigInt(10 ** 18);
      await takeSellOrder(order.id, total);
      toast.success(
        "Order taken successfully!",
        "Collateral locked. You can now mark it as filled after settlement."
      );
    } catch (error) {
      console.error(error);
      toast.error(
        "Transaction failed",
        error?.message || "Unable to take order. Please try again."
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleTakeBuy = async (order: { id: bigint }) => {
    try {
      setActionLoading(order.id.toString());
      // Convert from 24 decimals to 6 decimals (USDC)
      // amount is 18 decimals, unitPrice is 6 decimals, so divide by 10^18
      const total = (order.amount * order.unitPrice) / BigInt(10 ** 18);
      await takeBuyOrder(order.id, total);
      toast.success(
        "Order taken successfully!",
        "Collateral locked. You can now mark it as filled after settlement."
      );
    } catch (error) {
      console.error(error);
      toast.error(
        "Transaction failed",
        error?.message || "Unable to take order. Please try again."
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleMintUSDC = async () => {
    try {
      setMinting(true);
      toast.info("Minting test USDC...", "Transaction pending");
      await mintTestUSDC(parseUnits("10000", STABLE_DECIMALS));
      toast.success(
        "Minted 10,000 test USDC!",
        "You can now create orders with your new balance."
      );
    } catch (error) {
      console.error(error);
      toast.error(
        "Minting failed",
        error?.message || "Unable to mint test USDC."
      );
    } finally {
      setMinting(false);
    }
  };

  const handleMintTestTokens = async () => {
    // Use the deployed test token address (0x217D...)
    const testTokenAddress = "0x217D17025173E51871aA40848e8657A3EC8d64cb" as `0x${string}`;
    
    try {
      setMinting(true);
      toast.info("Minting test tokens...", "Transaction pending");
      await mintTestTokens(testTokenAddress, parseUnits("10000", 18)); // 10,000 tokens with 18 decimals
      toast.success(
        "Minted 10,000 test tokens!",
        "You can now deposit tokens for TGE settlement."
      );
    } catch (error) {
      console.error(error);
      toast.error(
        "Minting failed",
        error?.message || "Unable to mint test tokens."
      );
    } finally {
      setMinting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-3">
          <div className="flex items-center gap-3 flex-1">
            {/* Project Logo */}
            <ProjectImage 
              metadataURI={project?.metadataURI}
              imageType="logo"
              className="h-10 sm:h-12 max-w-[150px] sm:max-w-[200px] object-contain"
              fallbackText={project?.name || slug.toUpperCase()}
            />
            
            <Badge className={`${
              project?.isPoints === false
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
                : 'bg-violet-600/20 text-violet-400 border border-violet-500/30'
            } text-xs sm:text-sm px-2 sm:px-2.5 py-1`}>
              {project?.isPoints === false ? 'Tokens' : 'Points'}
            </Badge>
          </div>
          
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
            isOrderbookPaused 
              ? 'bg-red-950/30 border-red-500/50' 
              : 'bg-green-950/30 border-green-500/50'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${
              isOrderbookPaused ? 'bg-red-500 animate-pulse' : 'bg-green-500'
            }`} />
            <span className={`text-xs font-semibold ${
              isOrderbookPaused ? 'text-red-400' : 'text-green-400'
            }`}>
              {isOrderbookPaused ? 'Paused' : 'Active'}
            </span>
          </div>
        </div>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm text-zinc-400">
              <span className="font-bold text-white">{project?.name || slug.toUpperCase()}</span> Pre-TGE OTC Trading
            </p>
            
            {/* Project Reputation Badge */}
            {metadata?.twitterUrl && project?.name && (
              <ProjectReputationBadge 
                twitterUrl={metadata.twitterUrl}
                projectName={project.name}
                variant="compact"
              />
            )}
          </div>
          
          {/* Project Links from Registry */}
          {metadata && (metadata.twitterUrl || metadata.websiteUrl) && (
            <div className="flex gap-2 mt-2">
              {metadata.twitterUrl && (
                <a
                  href={ensureHttps(metadata.twitterUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 rounded-lg transition-colors group text-xs"
                >
                  <svg className="w-3.5 h-3.5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  <span className="font-medium group-hover:text-blue-400 transition-colors">
                    Twitter
                  </span>
                </a>
              )}
              {metadata.websiteUrl && (
                <a
                  href={ensureHttps(metadata.websiteUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 rounded-lg transition-colors group text-xs"
                >
                  <svg
                    className="w-3.5 h-3.5 text-green-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                    />
                  </svg>
                  <span className="font-medium group-hover:text-green-400 transition-colors">
                    Website
                  </span>
                </a>
              )}
            </div>
          )}
      </div>

      {/* Market Info Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-7 gap-3 mb-6 p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-lg">
        <div>
          <p className="text-[10px] text-zinc-500 uppercase mb-1">Last Price</p>
          <p className="text-sm font-semibold text-blue-400">
            {lastPrice ? `$${lastPrice.toFixed(2)}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 uppercase mb-1">Current Ask</p>
          <p className="text-sm font-semibold text-red-400">
            {lowestAsk ? `$${lowestAsk.toFixed(2)}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 uppercase mb-1">Current Bid</p>
          <p className="text-sm font-semibold text-green-400">
            {highestBid ? `$${highestBid.toFixed(2)}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 uppercase mb-1">Spread</p>
          <p className={`text-sm font-semibold ${
            spread === null ? 'text-zinc-400' : 
            spread < 5 ? 'text-green-400' : 
            spread < 15 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {spread !== null ? `${spread.toFixed(2)}%` : "—"}
          </p>
          {spread !== null && (
            <p className="text-[9px] text-zinc-500 mt-0.5">
              {spread < 5 ? "Tight" : spread < 15 ? "Moderate" : "Wide"}
            </p>
          )}
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 uppercase mb-1">Mid Market</p>
          <p className="text-sm font-semibold text-cyan-400">
            {midMarket ? `$${midMarket.toFixed(2)}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 uppercase mb-1">
            {tgeActivatedOrders.length > 0 ? "Settlement Status" : "Settle Starts"}
          </p>
          {tgeActivatedOrders.length > 0 ? (
            <p className="text-sm font-semibold text-yellow-400">IN SETTLEMENT</p>
          ) : (
            <p className="text-sm font-medium text-zinc-300">
              {settlementStartTime 
                ? settlementStartTime.toLocaleString("en-US", { 
                    month: "short", 
                    day: "numeric", 
                    hour: "2-digit", 
                    minute: "2-digit",
                    timeZone: "UTC",
                    timeZoneName: "short"
                  })
                : "TBA"}
            </p>
          )}
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 uppercase mb-1">Settle Ends</p>
          <p className="text-sm font-medium text-zinc-300">
            {settlementEndTime 
              ? settlementEndTime.toLocaleString("en-US", { 
                  month: "short", 
                  day: "numeric", 
                  hour: "2-digit", 
                  minute: "2-digit",
                  timeZone: "UTC",
                  timeZoneName: "short"
                })
              : "TBA"}
          </p>
        </div>
      </div>

      {/* Chart & AI Analysis - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Price Chart - Left */}
        <Card className="h-full">
          <h2 className="font-semibold mb-3 text-sm flex items-center gap-2">
            <LineChart className="w-4 h-4 text-cyan-400" />
            Price History
          </h2>
          <PriceChart orders={orders} allOrders={allOrders} />
        </Card>

        {/* Project Info with Grok Analysis - Right */}
        {project && metadata && (
          <div className="h-full">
            <ProjectInfo
              project={{
                name: project.name,
                slug: slug,
                twitterUrl: metadata.twitterUrl || '',
                websiteUrl: metadata.websiteUrl || '',
                description: metadata.description || '',
              }}
            />
          </div>
        )}
      </div>

      {/* Create Order - Full Width with Dynamic Border */}
      <div className={`mb-4 rounded-xl border-2 transition-colors ${
        side === "SELL" 
          ? "border-red-500/50 bg-zinc-900/50" 
          : "border-green-500/50 bg-zinc-900/50"
      }`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              {side === "SELL" ? (
                <MinusCircle className="w-4 h-4 text-red-400" />
              ) : (
                <PlusCircle className="w-4 h-4 text-green-400" />
              )}
              Create Order
            </h2>
            <Link 
              href="/calculator"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative"
            >
              <Calculator className="w-5 h-5 text-zinc-500 hover:text-cyan-400 transition-colors cursor-pointer" />
              <div className="absolute right-0 top-full mt-2 w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-10">
                <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 shadow-lg">
                  <p className="text-xs text-zinc-300">
                    Unsure about pricing? Use our calculator to guide you.
                  </p>
                </div>
              </div>
            </Link>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Sell/Buy Toggle */}
            <div className="lg:col-span-4">
              <div className="flex gap-2">
                <Button 
                  onClick={() => setSide("SELL")}
                  variant="custom"
                  className={side === "SELL" ? "bg-red-600 hover:bg-red-700" : "bg-zinc-800 hover:bg-zinc-700"}
                  disabled={creating}
                >
                  Sell
                </Button>
                <Button 
                  onClick={() => setSide("BUY")}
                  variant="custom"
                  className={side === "BUY" ? "bg-green-600 hover:bg-green-700" : "bg-zinc-800 hover:bg-zinc-700"}
                  disabled={creating}
                >
                  Buy
                </Button>
              </div>
            </div>

          {/* Form Fields */}
          <div>
            <label className="text-xs text-zinc-400 block mb-1">
              Amount ({project?.isPoints === false ? 'Tokens' : 'Points'})
            </label>
            <Input 
              type="number" 
              min={0} 
              value={amount} 
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100"
              disabled={creating}
            />
          </div>
          
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Unit Price (USDC)</label>
            <Input 
              type="number" 
              min={0} 
              step="0.01"
              value={unitPrice} 
              onChange={(e) => setUnitPrice(e.target.value)}
              placeholder="1.5"
              disabled={creating}
            />
            {/* Quick Price Buttons */}
            {midMarket && (
              <div className="flex gap-1 mt-1">
                <button
                  onClick={() => setUnitPrice((midMarket * 0.95).toFixed(2))}
                  disabled={creating}
                  className="px-1.5 py-0.5 text-[10px] bg-zinc-800/50 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-300 transition-colors"
                >
                  -5%
                </button>
                <button
                  onClick={() => setUnitPrice((midMarket * 0.98).toFixed(2))}
                  disabled={creating}
                  className="px-1.5 py-0.5 text-[10px] bg-zinc-800/50 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-300 transition-colors"
                >
                  -2%
                </button>
                <button
                  onClick={() => setUnitPrice(midMarket.toFixed(2))}
                  disabled={creating}
                  className="px-2 py-0.5 text-[10px] bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 rounded text-cyan-400 transition-colors font-medium"
                >
                  Mid
                </button>
                <button
                  onClick={() => setUnitPrice((midMarket * 1.02).toFixed(2))}
                  disabled={creating}
                  className="px-1.5 py-0.5 text-[10px] bg-zinc-800/50 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-300 transition-colors"
                >
                  +2%
                </button>
                <button
                  onClick={() => setUnitPrice((midMarket * 1.05).toFixed(2))}
                  disabled={creating}
                  className="px-1.5 py-0.5 text-[10px] bg-zinc-800/50 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-300 transition-colors"
                >
                  +5%
                </button>
              </div>
            )}
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-zinc-400">Total (USDC)</label>
              {usdcBalance && address && (
                <span className="text-[10px] text-zinc-500">
                  Balance: {parseFloat(formatUnits(usdcBalance, STABLE_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC
                </span>
              )}
            </div>
            <div className="w-full rounded-md px-3 py-2 bg-zinc-800/50 border border-cyan-500/30 text-sm font-medium text-cyan-400">
              ${total.toLocaleString()}
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">{side === "SELL" ? "Seller" : "Buyer"} locks ${total.toLocaleString()}</p>
          </div>
          
          <div>
            <label className="text-xs text-zinc-400 block mb-1 invisible">Placeholder</label>
            <button
              onClick={handleCreate} 
              disabled={creating || !address || !amount || !unitPrice || !project}
              className={`w-full rounded-md border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 ${
                side === "SELL" 
                  ? "bg-red-600 hover:bg-red-700 border-red-500/50" 
                  : "bg-green-600 hover:bg-green-700 border-green-500/50"
              }`}
            >
              {creating ? "Creating..." : !project ? "Loading..." : `Create ${side}`}
            </button>
            <p className="text-[10px] text-zinc-500 mt-1 text-center invisible">Good-Til-Cancel • No Expiry</p>
          </div>

          {!address && (
            <div className="lg:col-span-4">
              <p className="text-xs text-zinc-400 text-center">Connect wallet to create orders</p>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Sell & Buy Orders - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Buy Orders Table */}
        <Card>
          <h2 className="font-semibold mb-3 flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-green-400" />
              Buy Orders (Users Buying)
            </span>
            <Badge className="bg-green-600 text-xs">{buyOrders.length}</Badge>
          </h2>
          
          {loading && <p className="text-xs text-zinc-400">Loading...</p>}
          
          {!loading && buyOrders.length === 0 && (
            <div className="text-center py-8">
              <TrendingUp className="w-12 h-12 text-green-500/30 mx-auto mb-3" />
              <p className="text-sm text-zinc-400 mb-1">No buy orders yet</p>
              <p className="text-xs text-zinc-500">Be the first to create a buy order!</p>
            </div>
          )}
          
          {!loading && buyOrders.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left py-3 px-3 text-zinc-400 font-medium">Price</th>
                    <th className="text-center py-3 px-3 text-zinc-400 font-medium">Amount</th>
                    <th className="text-center py-3 px-3 text-zinc-400 font-medium">Total</th>
                    <th className="text-center py-3 px-3 text-zinc-400 font-medium">Collateral</th>
                    <th className="text-center py-3 px-3 text-zinc-400 font-medium">Maker</th>
                    <th className="text-center py-3 px-3 text-zinc-400 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {buyOrders.map((order) => {
                    // Calculate total in stable decimals (USD value)
                    // amount is 18 decimals, unitPrice is 6 decimals, so divide by 10^18
                    const total = (order.amount * order.unitPrice) / BigInt(10 ** 18);
                    const hasSellerLock = order.sellerCollateral > 0n;
                    const hasBuyerLock = order.buyerFunds > 0n;
                    const canTake = address && address.toLowerCase() !== order.maker.toLowerCase() && !hasSellerLock;
                    
                    // For buy orders: buyer posts buyerFunds, seller posts sellerCollateral
                    const buyerCollateral = hasBuyerLock ? formatUnits(order.buyerFunds, STABLE_DECIMALS) : "0";
                    const sellerCollateral = hasSellerLock ? formatUnits(order.sellerCollateral, STABLE_DECIMALS) : "0";
                    const totalCollateral = parseFloat(buyerCollateral) + parseFloat(sellerCollateral);

                    return (
                      <tr key={order.id.toString()} className="border-b border-zinc-800/50 hover:bg-zinc-900/30 transition-colors">
                        <td className="py-3 px-3 font-medium text-zinc-100">
                          ${formatUnits(order.unitPrice, STABLE_DECIMALS)}
                        </td>
                        <td className="py-3 px-3 text-center text-zinc-300">
                          {formatUnits(order.amount, 18)}
                        </td>
                        <td className="py-3 px-3 text-center text-zinc-400">
                          ${formatUnits(total, STABLE_DECIMALS)}
                        </td>
                        <td className="py-3 px-3 text-center text-zinc-300">
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-xs">{totalCollateral.toFixed(2)}</span>
                            <span className="text-[10px] text-cyan-400">USDC</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center">
                            <ReputationBadge address={order.maker} variant="compact" />
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {canTake && (
                            <Button 
                              size="sm"
                              variant="custom"
                              onClick={() => handleTakeBuy(order)}
                              disabled={!!actionLoading}
                              className="bg-red-600 hover:bg-red-700 text-xs h-7 px-3"
                            >
                              {actionLoading === order.id.toString() ? "..." : "Sell"}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Sell Orders Table */}
        <Card>
          <h2 className="font-semibold mb-3 flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <Package className="w-4 h-4 text-red-400" />
              Sell Orders (Users Selling)
            </span>
            <Badge className="bg-red-600 text-xs">{sellOrders.length}</Badge>
          </h2>
          
          {loading && <p className="text-xs text-zinc-400">Loading...</p>}
          
          {!loading && sellOrders.length === 0 && (
            <div className="text-center py-8">
              <TrendingUp className="w-12 h-12 text-red-500/30 mx-auto mb-3" />
              <p className="text-sm text-zinc-400 mb-1">No sell orders yet</p>
              <p className="text-xs text-zinc-500">Be the first to create a sell order!</p>
            </div>
          )}
          
          {!loading && sellOrders.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left py-3 px-3 text-zinc-400 font-medium">Price</th>
                    <th className="text-center py-3 px-3 text-zinc-400 font-medium">Amount</th>
                    <th className="text-center py-3 px-3 text-zinc-400 font-medium">Total</th>
                    <th className="text-center py-3 px-3 text-zinc-400 font-medium">Collateral</th>
                    <th className="text-center py-3 px-3 text-zinc-400 font-medium">Maker</th>
                    <th className="text-center py-3 px-3 text-zinc-400 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {sellOrders.map((order) => {
                    // Calculate total in stable decimals (USD value)
                    // amount is 18 decimals, unitPrice is 6 decimals, so divide by 10^18
                    const total = (order.amount * order.unitPrice) / BigInt(10 ** 18);
                    const hasSellerLock = order.sellerCollateral > 0n;
                    const hasBuyerLock = order.buyerFunds > 0n;
                    const canTake = address && address.toLowerCase() !== order.maker.toLowerCase() && !hasBuyerLock;
                    
                    // For sell orders: seller posts sellerCollateral, buyer posts buyerFunds
                    const sellerCollateral = hasSellerLock ? formatUnits(order.sellerCollateral, STABLE_DECIMALS) : "0";
                    const buyerCollateral = hasBuyerLock ? formatUnits(order.buyerFunds, STABLE_DECIMALS) : "0";
                    const totalCollateral = parseFloat(sellerCollateral) + parseFloat(buyerCollateral);

                    const orderSize = Number(formatUnits(total, STABLE_DECIMALS));
                    const depthPercentage = maxSellOrder > 0 ? (orderSize / maxSellOrder) * 100 : 0;

                    return (
                      <tr key={order.id.toString()} className="border-b border-zinc-800/50 hover:bg-zinc-900/30 transition-colors">
                        <td className="py-3 px-3 font-medium text-zinc-100">
                          ${formatUnits(order.unitPrice, STABLE_DECIMALS)}
                        </td>
                        <td className="py-3 px-3 text-center text-zinc-300">
                          {formatUnits(order.amount, 18)}
                        </td>
                        <td className="py-3 px-3 text-center text-zinc-400">
                          ${formatUnits(total, STABLE_DECIMALS)}
                        </td>
                        <td className="py-3 px-3 text-center text-zinc-300">
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-xs">{totalCollateral.toFixed(2)}</span>
                            <span className="text-[10px] text-cyan-400">USDC</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center">
                            <ReputationBadge address={order.maker} variant="compact" />
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {canTake && (
                            <Button 
                              size="sm"
                              variant="custom"
                              onClick={() => handleTakeSell(order)}
                              disabled={!!actionLoading}
                              className="bg-green-600 hover:bg-green-700 text-xs h-7 px-3"
                            >
                              {actionLoading === order.id.toString() ? "..." : "Buy"}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Filled Orders Section */}
      <Card className="mt-4">
        <h2 className="font-semibold mb-3 flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-blue-400" />
            Filled Orders
          </span>
          <Badge className="bg-blue-600 text-xs">{filledOrders.length}</Badge>
        </h2>
        
        {loading && <p className="text-xs text-zinc-400">Loading...</p>}
        
        {!loading && filledOrders.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-zinc-400 mb-1">No filled orders yet</p>
            <p className="text-xs text-zinc-500">Orders will appear here once both sides have deposited collateral</p>
          </div>
        )}
        
        {!loading && filledOrders.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-3 px-3 text-zinc-400 font-medium">Type</th>
                  <th className="text-left py-3 px-3 text-zinc-400 font-medium">Price</th>
                  <th className="text-center py-3 px-3 text-zinc-400 font-medium">Amount</th>
                  <th className="text-center py-3 px-3 text-zinc-400 font-medium">Total</th>
                  <th className="text-center py-3 px-3 text-zinc-400 font-medium">Seller</th>
                  <th className="text-center py-3 px-3 text-zinc-400 font-medium">Buyer</th>
                  <th className="text-center py-3 px-3 text-zinc-400 font-medium">Order ID</th>
                </tr>
              </thead>
              <tbody>
                {filledOrders.sort((a, b) => Number(b.id) - Number(a.id)).map((order) => {
                  // Calculate total in stable decimals (USD value)
                  // amount is 18 decimals, unitPrice is 6 decimals, so divide by 10^18
                  const total = (order.amount * order.unitPrice) / BigInt(10 ** 18);
                  
                  // Determine actual seller and buyer addresses
                  // If order.isSell: maker is seller, buyer took it
                  // If order.isBuy: maker is buyer, seller took it
                  const zeroAddress = '0x0000000000000000000000000000000000000000';
                  const sellerAddress = order.isSell 
                    ? order.maker 
                    : (order.seller && order.seller.toLowerCase() !== zeroAddress.toLowerCase() ? order.seller : order.maker);
                  const buyerAddress = !order.isSell 
                    ? order.maker 
                    : (order.buyer && order.buyer.toLowerCase() !== zeroAddress.toLowerCase() ? order.buyer : order.maker);
                  
                  return (
                    <tr key={order.id.toString()} className="border-b border-zinc-800/50 hover:bg-zinc-900/30 transition-colors">
                      <td className="py-3 px-3">
                        <Badge className={order.isSell ? "bg-red-600/20 text-red-400 text-xs" : "bg-green-600/20 text-green-400 text-xs"}>
                          {order.isSell ? "SELL" : "BUY"}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 font-medium text-zinc-100">
                        ${formatUnits(order.unitPrice, STABLE_DECIMALS)}
                      </td>
                      <td className="py-3 px-3 text-center text-zinc-300">
                        {formatUnits(order.amount, 18)}
                      </td>
                      <td className="py-3 px-3 text-center text-zinc-400">
                        ${formatUnits(total, STABLE_DECIMALS)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-xs text-zinc-400">
                            {sellerAddress.slice(0, 6)}...{sellerAddress.slice(-4)}
                          </span>
                          <ReputationBadge address={sellerAddress} variant="compact" />
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-xs text-zinc-400">
                            {buyerAddress.slice(0, 6)}...{buyerAddress.slice(-4)}
                          </span>
                          <ReputationBadge address={buyerAddress} variant="compact" />
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="text-xs text-zinc-500">
                          #{order.id.toString()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
