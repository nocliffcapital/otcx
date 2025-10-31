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
import { useReadContract, useBlockNumber } from "wagmi";
import { PriceChart } from "@/components/PriceChart";
import { TrendingUp, Calculator, ArrowUpCircle, ArrowDownCircle, LineChart, PlusCircle, MinusCircle, ShoppingCart, Package, CheckCircle, DollarSign, ArrowDown, ArrowUp, Percent, Activity, Clock, User, Loader2, AlertCircle, Terminal, Database, Cpu } from "lucide-react";
import Link from "next/link";
import ReputationBadge from "@/components/ReputationBadge";
import ProjectReputationBadge from "@/components/ProjectReputationBadge";
import { UsdcIcon } from "@/components/icons/UsdcIcon";

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

  // Read user's USDC balance
  const { data: userBalance } = useReadContract({
    address: STABLE_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  // V3: Use projectId (bytes32) instead of tokenAddress
  const projectId = slugToProjectId(slug);
  const { orders, allOrders, loading } = useOrders(projectId);

  // Check if orderbook is paused
  const { data: isPausedData } = useReadContract({
    address: ORDERBOOK_ADDRESS,
    abi: ESCROW_ORDERBOOK_ABI,
    functionName: "paused",
  });
  const isOrderbookPaused = isPausedData === true;
  const { data: blockNumber } = useBlockNumber({ watch: true });
  
  // Check if TGE has been activated for this project
  const { data: projectTgeActivated } = useReadContract({
    address: ORDERBOOK_ADDRESS,
    abi: ESCROW_ORDERBOOK_ABI,
    functionName: "projectTgeActivated",
    args: [projectId],
  });
  const isTgeActivated = projectTgeActivated === true;
  
  // Fetch settlement fee (in basis points, 10000 = 100%)
  const { data: settlementFeeBps } = useReadContract({
    address: ORDERBOOK_ADDRESS,
    abi: ESCROW_ORDERBOOK_ABI,
    functionName: "settlementFeeBps",
  });
  
  // Calculate fee percentage and multiplier
  const feePercentage = settlementFeeBps ? Number(settlementFeeBps) / 100 : 0.5; // Default 0.5%
  const feeMultiplier = 1 - (feePercentage / 100); // e.g., 0.995 for 0.5%
  
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
  
  // Fetch minimum order value
  const { data: minOrderValue } = useReadContract({
    address: ORDERBOOK_ADDRESS,
    abi: ESCROW_ORDERBOOK_ABI,
    functionName: "minOrderValue",
  });
  
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
          httpUrl = `https://dweb.link/ipfs/${cid}`;
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
  const minValue = minOrderValue ? Number(minOrderValue) / 1e6 : 100; // Convert to USDC, default $100
  const isBelowMinimum = total > 0 && total < minValue;

  // Filter orders: OPEN (0) orders for orderbook, FUNDED (1) for filled section
  // Debug logging
  console.log('All orders for project:', orders);
  console.log('Orders filtered by projectId:', projectId);
  
  // Sort orders by best price first
  // Sell orders: lowest price first (best for buyers)
  const sellOrders = orders
    .filter(o => o.isSell && o.status === 0)
    .sort((a, b) => Number(a.unitPrice) - Number(b.unitPrice));
  
  // Buy orders: highest price first (best for sellers)
  const buyOrders = orders
    .filter(o => !o.isSell && o.status === 0)
    .sort((a, b) => Number(b.unitPrice) - Number(a.unitPrice));
  
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

  const handleTakeSell = async (order: { id: bigint; amount: bigint; unitPrice: bigint }) => {
    try {
      setActionLoading(order.id.toString());
      // Convert from 24 decimals to 6 decimals (USDC)
      // amount is 18 decimals, unitPrice is 6 decimals, so divide by 10^18
      const total = (order.amount * order.unitPrice) / BigInt(10 ** 18);
      
      // Check if user has sufficient balance
      const balance = userBalance as bigint || 0n;
      if (balance < total) {
        const balanceFormatted = parseFloat(formatUnits(balance, STABLE_DECIMALS)).toFixed(2);
        const requiredFormatted = parseFloat(formatUnits(total, STABLE_DECIMALS)).toFixed(2);
        toast.error(
          "Insufficient USDC Balance",
          `You need $${requiredFormatted} USDC but only have $${balanceFormatted} USDC. Use the "Mint Test USDC" button in the navbar to get test tokens.`
        );
        setActionLoading(null);
        return;
      }

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

  const handleTakeBuy = async (order: { id: bigint; amount: bigint; unitPrice: bigint }) => {
    try {
      setActionLoading(order.id.toString());
      // Convert from 24 decimals to 6 decimals (USDC)
      // Seller must post 110% collateral
      const total = ((order.amount * order.unitPrice) / BigInt(10 ** 18)) * 110n / 100n;
      
      // Check if user has sufficient balance
      const balance = userBalance as bigint || 0n;
      if (balance < total) {
        const balanceFormatted = parseFloat(formatUnits(balance, STABLE_DECIMALS)).toFixed(2);
        const requiredFormatted = parseFloat(formatUnits(total, STABLE_DECIMALS)).toFixed(2);
        toast.error(
          "Insufficient USDC Balance",
          `You need $${requiredFormatted} USDC (110% collateral) but only have $${balanceFormatted} USDC. Use the "Mint Test USDC" button in the navbar to get test tokens.`
        );
        setActionLoading(null);
        return;
      }

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
    // Use the mock token address from environment variables
    const testTokenAddress = (process.env.NEXT_PUBLIC_MOCK_TOKEN || '') as `0x${string}`;
    
    if (!testTokenAddress) {
      toast.error("Configuration error", "Mock token address not configured");
      return;
    }
    
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
      {/* Terminal-style header */}
      <div className="border rounded p-4 mb-6 backdrop-blur-sm font-mono" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex-shrink-0">
              <ProjectImage 
                metadataURI={project?.metadataURI}
                imageType="logo"
                className="h-8 w-auto max-w-[180px] sm:max-w-[200px] md:h-10 md:max-w-[250px] object-contain"
                fallbackText={project?.name || slug.toUpperCase()}
              />
            </div>
            <div>
              <span className="text-zinc-300 text-xs mb-1 block">otcX://protocol/markets/{slug}</span>
              <p className="text-xs font-bold text-zinc-300/70 whitespace-nowrap sm:whitespace-normal">
                {(project?.name || slug.toUpperCase())} • Pre-TGE OTC Trading
              </p>
              {/* Social Links */}
              {(metadata?.twitterUrl || metadata?.websiteUrl) && (
                <div className="flex items-center gap-2.5 flex-wrap mt-1">
                {metadata?.twitterUrl && (
                  <a
                    href={ensureHttps(metadata.twitterUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-medium text-zinc-400 hover:text-zinc-300 transition-all"
                    style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    Twitter
                  </a>
                )}
                
                {metadata?.websiteUrl && (
                  <a
                    href={ensureHttps(metadata.websiteUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-medium text-zinc-400 hover:text-zinc-300 transition-all"
                    style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    Website
                  </a>
                )}
              </div>
            )}
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end sm:items-end">
            <div className="flex items-center gap-2 flex-wrap">
              <div className={`inline-flex items-center px-3 py-1.5 rounded border ${
                project?.isPoints === false
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' 
                  : 'bg-purple-500/20 text-purple-400 border-purple-500/50'
              }`}>
                <span className="text-xs font-semibold">{project?.isPoints === false ? 'Tokens' : 'Points'}</span>
              </div>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded border ${
                isOrderbookPaused 
                  ? 'bg-red-950/30 border-red-500/50' 
                  : 'bg-green-950/30 border-green-500/50'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  isOrderbookPaused ? 'bg-red-500 animate-pulse' : 'bg-green-500 animate-pulse'
                }`} />
                <span className={`text-xs font-mono font-semibold ${
                  isOrderbookPaused ? 'text-red-400' : 'text-green-400'
                }`}>
                  {isOrderbookPaused ? 'PAUSED' : 'ONLINE'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
              <span className="hidden sm:inline">BLOCK #{blockNumber?.toString() || '...'}</span>
              <span className="sm:hidden">#{blockNumber?.toString() || '...'}</span>
              <Cpu className="w-3 h-3" />
            </div>
          </div>
        </div>
      </div>

      {/* Market Info Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6 p-4 rounded border" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
        <div>
          <p className="text-[10px] text-zinc-500 uppercase mb-1 flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            Last Price
          </p>
          <p className="text-sm font-semibold text-zinc-300">
            {lastPrice ? `$${lastPrice.toFixed(2)}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 uppercase mb-1 flex items-center gap-1">
            <ArrowDown className="w-3 h-3" />
            Current Ask
          </p>
          <p className="text-sm font-semibold text-zinc-300">
            {lowestAsk ? `$${lowestAsk.toFixed(2)}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 uppercase mb-1 flex items-center gap-1">
            <ArrowUp className="w-3 h-3" />
            Current Bid
          </p>
          <p className="text-sm font-semibold text-zinc-300">
            {highestBid ? `$${highestBid.toFixed(2)}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 uppercase mb-1 flex items-center gap-1">
            <Percent className="w-3 h-3" />
            Spread
          </p>
          <p className={`text-sm font-semibold text-zinc-300`}>
            {spread !== null ? `${spread.toFixed(2)}%` : "—"}
          </p>
          {spread !== null && (
            <p className="text-[9px] text-zinc-500 mt-0.5">
              {spread < 5 ? "Tight" : spread < 15 ? "Moderate" : "Wide"}
            </p>
          )}
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 uppercase mb-1 flex items-center gap-1">
            <Activity className="w-3 h-3" />
            Mid Market
          </p>
          <p className="text-sm font-semibold text-zinc-300">
            {midMarket ? `$${midMarket.toFixed(2)}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 uppercase mb-1 flex items-center gap-1">
            <Clock className="w-3 h-3" />
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
          <p className="text-[10px] text-zinc-500 uppercase mb-1 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Settle Ends
          </p>
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

      {/* Price Chart & Create Order - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Price Chart - Left (2 columns) */}
        <Card className="lg:col-span-2">
          <h2 className="font-semibold mb-3 text-sm flex items-center gap-2">
            <LineChart className="w-4 h-4 text-zinc-300" />
            Price History
          </h2>
          <PriceChart orders={orders} allOrders={allOrders} />
        </Card>

        {/* Create Order - Right (1 column, thinner) */}
        <div className="rounded border transition-colors" style={{ backgroundColor: '#121218', borderColor: '#2b2b30', opacity: isTgeActivated ? 0.6 : 1 }}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                {side === "SELL" ? (
                  <MinusCircle className="w-4 h-4 text-red-400" />
                ) : (
                  <PlusCircle className="w-4 h-4 text-green-400" />
                )}
                Create Order
                {isTgeActivated && (
                  <Badge className="bg-yellow-600 text-xs ml-2">TGE Active</Badge>
                )}
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
            
            {/* TGE Active Warning */}
            {isTgeActivated && (
              <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-3 mb-3">
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-yellow-400 mb-1">TGE Settlement Active</p>
                    <p className="text-[10px] text-zinc-400">
                      New orders cannot be created during the settlement period. Existing orders can still be settled.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Stack all fields vertically */}
            <div className="space-y-3">
              {/* Buy/Sell Toggle - Buy on left, Sell on right */}
              <div className="flex gap-2">
                <Button 
                  onClick={() => setSide("BUY")} 
                  variant="custom" 
                  className={`flex-1 border ${side === 'BUY' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'}`}
                  style={{ borderColor: side === 'BUY' ? 'rgba(34,197,94,0.5)' : '#2b2b30' }}
                >
                  BUY
                </Button>
                <Button 
                  onClick={() => setSide("SELL")} 
                  variant="custom" 
                  className={`flex-1 border ${side === 'SELL' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'}`}
                  style={{ borderColor: side === 'SELL' ? 'rgba(239,68,68,0.5)' : '#2b2b30' }}
                >
                  SELL
                </Button>
              </div>

              {/* Amount Field */}
              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  Amount ({project?.isPoints === false ? 'Tokens' : 'Points'})
                </label>
                <Input 
                  type="number" 
                  min={0} 
                  value={amount} 
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  disabled={creating || isTgeActivated}
                />
              </div>
              
              {/* Unit Price Field */}
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Unit Price (USDC)</label>
                <Input 
                  type="number" 
                  min={0} 
                  step="0.01"
                  value={unitPrice} 
                  onChange={(e) => setUnitPrice(e.target.value)}
                  placeholder="0.00"
                  disabled={creating || isTgeActivated}
                />
              </div>
              
              {/* Total Field */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-zinc-400">Total (USDC)</label>
                  {usdcBalance && address && (
                    <span className="text-[10px] text-zinc-500">
                      Bal: {parseFloat(formatUnits(usdcBalance, STABLE_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
                <div className="w-full rounded px-3 py-2 text-sm font-medium" style={{ backgroundColor: '#121218', borderColor: '#2b2b30', border: '1px solid', color: '#d4d4d8' }}>
                  ${total === 0 ? '0.00' : total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">{side === "SELL" ? "Seller" : "Buyer"} locks ${total === 0 ? '0.00' : total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              
              {/* You Will Receive Info */}
              <div className="rounded p-3 border" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
                <p className="text-[10px] text-zinc-400 mb-1.5">When your order fills:</p>
                {total > 0 && amount ? (
                  <div className="space-y-1">
                    {side === "SELL" ? (
                      <>
                        <p className="text-xs text-zinc-300">
                          You receive: <span className="font-semibold text-green-400">${(total * feeMultiplier).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC</span>
                        </p>
                        <p className="text-[10px] text-zinc-500">
                          (${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} - {feePercentage}% fee)
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-zinc-300">
                          You receive: <span className="font-semibold text-green-400">{(parseFloat(amount) * feeMultiplier).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} {project?.assetType === "Points" ? "points worth of tokens" : "tokens"}</span>
                        </p>
                        <p className="text-[10px] text-zinc-500">
                          ({parseFloat(amount).toLocaleString()} {project?.assetType === "Points" ? "points" : "tokens"} - {feePercentage}% fee)
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 italic">Enter amount and price to see what you'll receive</p>
                )}
              </div>

              {/* Minimum Order Warning */}
              {isBelowMinimum && (
                <div className="p-2.5 bg-red-950/30 border border-red-500/50 rounded-lg">
                  <div className="flex items-center gap-1.5 text-xs text-red-400">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Order value must be at least ${minValue.toFixed(2)} USDC</span>
                  </div>
                </div>
              )}

              {/* Create Button - Moved to bottom */}
              {!address ? (
                <div>
                  <p className="text-xs text-zinc-400 text-center">Connect wallet to create orders</p>
                </div>
              ) : (
                <div>
                  <button
                    onClick={handleCreate} 
                    disabled={creating || !address || !amount || !unitPrice || !project || isTgeActivated || isBelowMinimum}
                    className="w-full rounded text-sm font-mono transition-colors disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 border"
                    style={{ backgroundColor: '#2b2b30', borderColor: '#2b2b30', color: 'white' }}
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                        Creating...
                      </>
                    ) : isTgeActivated ? (
                      "TGE Active - Orders Closed"
                    ) : !project ? (
                      "Loading..."
                    ) : (
                      `Create ${side}`
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Buy & Sell Orders - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Buy Orders Table - Left */}
        <Card>
          <h2 className="font-semibold mb-3 flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-green-400" />
              buy_orders
            </span>
            <Badge className="bg-zinc-700 text-xs text-zinc-300">{buyOrders.length}</Badge>
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
                  <tr className="border-b" style={{ borderColor: '#2b2b30' }}>
                    <th className="text-left py-3 px-3 text-xs font-bold text-zinc-300 uppercase tracking-wider">price</th>
                    <th className="text-center py-3 px-3 text-xs font-bold text-zinc-300 uppercase tracking-wider">amount</th>
                    <th className="text-center py-3 px-3 text-xs font-bold text-zinc-300 uppercase tracking-wider">total</th>
                    <th className="text-center py-3 px-3 text-xs font-bold text-zinc-300 uppercase tracking-wider">collateral</th>
                    <th className="text-center py-3 px-3 text-xs font-bold text-zinc-300 uppercase tracking-wider">maker</th>
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
                      <tr key={order.id.toString()} className="border-b transition-colors" style={{ borderColor: '#2b2b30' }}>
                        <td className="py-3 px-3 font-medium text-zinc-100">
                          ${Number(formatUnits(order.unitPrice, STABLE_DECIMALS)).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-center text-zinc-300">
                          {Number(formatUnits(order.amount, 18)).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-center text-zinc-400">
                          ${Number(formatUnits(total, STABLE_DECIMALS)).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-center text-zinc-300">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="text-xs">{totalCollateral.toFixed(2)}</span>
                            <UsdcIcon size={14} />
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-zinc-400 font-mono text-[10px] w-[90px] text-right">
                              {order.maker.slice(0, 6)}...{order.maker.slice(-4)}
                            </span>
                            <ReputationBadge address={order.maker} variant="compact" />
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {canTake ? (
                            <Button 
                              size="sm"
                              variant="custom"
                              onClick={() => handleTakeBuy(order)}
                              disabled={!!actionLoading}
                              className="text-xs h-7 px-3 border"
                              style={{ backgroundColor: '#2b2b30', borderColor: '#2b2b30' }}
                            >
                              {actionLoading === order.id.toString() ? (
                                <>
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  Selling...
                                </>
                              ) : "Sell"}
                            </Button>
                          ) : address && address.toLowerCase() === order.maker.toLowerCase() ? (
                            <div className="flex items-center justify-center">
                              <User className="w-4 h-4 text-zinc-500" title="Your order" />
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Sell Orders Table - Right */}
        <Card>
          <h2 className="font-semibold mb-3 flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <Package className="w-4 h-4 text-red-400" />
              sell_orders
            </span>
            <Badge className="bg-zinc-700 text-xs text-zinc-300">{sellOrders.length}</Badge>
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
                  <tr className="border-b" style={{ borderColor: '#2b2b30' }}>
                    <th className="text-left py-3 px-3 text-xs font-bold text-zinc-300 uppercase tracking-wider">price</th>
                    <th className="text-center py-3 px-3 text-xs font-bold text-zinc-300 uppercase tracking-wider">amount</th>
                    <th className="text-center py-3 px-3 text-xs font-bold text-zinc-300 uppercase tracking-wider">total</th>
                    <th className="text-center py-3 px-3 text-xs font-bold text-zinc-300 uppercase tracking-wider">collateral</th>
                    <th className="text-center py-3 px-3 text-xs font-bold text-zinc-300 uppercase tracking-wider">maker</th>
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
                      <tr key={order.id.toString()} className="border-b transition-colors" style={{ borderColor: '#2b2b30' }}>
                        <td className="py-3 px-3 font-medium text-zinc-100">
                          ${Number(formatUnits(order.unitPrice, STABLE_DECIMALS)).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-center text-zinc-300">
                          {Number(formatUnits(order.amount, 18)).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-center text-zinc-400">
                          ${Number(formatUnits(total, STABLE_DECIMALS)).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-center text-zinc-300">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="text-xs">{totalCollateral.toFixed(2)}</span>
                            <UsdcIcon size={14} />
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-zinc-400 font-mono text-[10px] w-[90px] text-right">
                              {order.maker.slice(0, 6)}...{order.maker.slice(-4)}
                            </span>
                            <ReputationBadge address={order.maker} variant="compact" />
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {canTake ? (
                            <Button 
                              size="sm"
                              variant="custom"
                              onClick={() => handleTakeSell(order)}
                              disabled={!!actionLoading}
                              className="text-xs h-7 px-3 border"
                              style={{ backgroundColor: '#2b2b30', borderColor: '#2b2b30' }}
                            >
                              {actionLoading === order.id.toString() ? (
                                <>
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  Buying...
                                </>
                              ) : "Buy"}
                            </Button>
                          ) : address && address.toLowerCase() === order.maker.toLowerCase() ? (
                            <div className="flex items-center justify-center">
                              <User className="w-4 h-4 text-zinc-500" title="Your order" />
                            </div>
                          ) : null}
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
            <CheckCircle className="w-4 h-4 text-zinc-300" />
            filled_orders
          </span>
          <Badge className="bg-zinc-700 text-xs text-zinc-300">{filledOrders.length}</Badge>
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
                    <tr key={order.id.toString()} className="border-b transition-colors" style={{ borderColor: '#2b2b30' }}>
                      <td className="py-3 px-3">
                        <Badge className="bg-zinc-700 text-zinc-300 text-xs">
                          {order.isSell ? "SELL" : "BUY"}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 font-medium text-zinc-100">
                        ${Number(formatUnits(order.unitPrice, STABLE_DECIMALS)).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center text-zinc-300">
                        {Number(formatUnits(order.amount, 18)).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center text-zinc-400">
                        ${Number(formatUnits(total, STABLE_DECIMALS)).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-xs text-zinc-400 font-mono w-[90px] text-right">
                            {sellerAddress.slice(0, 6)}...{sellerAddress.slice(-4)}
                          </span>
                          <ReputationBadge address={sellerAddress} variant="compact" />
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-xs text-zinc-400 font-mono w-[90px] text-right">
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
