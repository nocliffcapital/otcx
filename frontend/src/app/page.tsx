"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/Logo";
import { Shield, Zap, TrendingUp, Lock, Search } from "lucide-react";
import { usePublicClient } from "wagmi";
import { useEffect, useState } from "react";
import { ORDERBOOK_ADDRESS, ESCROW_ORDERBOOK_ABI, STABLE_DECIMALS } from "@/lib/contracts";
import { formatUnits } from "viem";

// Animated chart component
function AnimatedChart() {
  const [offset, setOffset] = useState(0);
  
  useEffect(() => {
    // Continuous smooth animation
    const interval = setInterval(() => {
      setOffset((prev) => prev + 0.5);
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // Generate points with varying amplitudes (like a real chart)
  const generatePoints = () => {
    const points: { x: number; y: number }[] = [];
    const numPoints = 80;
    
    for (let i = 0; i < numPoints; i++) {
      const x = (i / (numPoints - 1)) * 100;
      
      // Combine multiple sine waves with different frequencies and amplitudes
      // This creates a more natural, varied pattern
      const wave1 = Math.sin((i + offset) * 0.15) * 15; // Large slow waves
      const wave2 = Math.sin((i + offset) * 0.4) * 8;   // Medium waves
      const wave3 = Math.sin((i + offset) * 0.8) * 4;   // Small fast waves
      
      // Add some trend (gradual rise and fall)
      const trend = Math.sin((i + offset * 0.3) * 0.05) * 10;
      
      const y = 50 + wave1 + wave2 + wave3 + trend;
      
      points.push({ x, y: Math.max(10, Math.min(90, y)) }); // Clamp between 10-90
    }
    
    return points;
  };

  const points = generatePoints();
  
  const pathData = points.reduce((acc, point, i) => {
    if (i === 0) return `M ${point.x} ${point.y}`;
    // Use smooth curves instead of straight lines
    const prevPoint = points[i - 1];
    const controlX = (prevPoint.x + point.x) / 2;
    return `${acc} Q ${controlX} ${prevPoint.y}, ${point.x} ${point.y}`;
  }, "");

  return (
    <div className="absolute inset-0 overflow-hidden opacity-14">
      <svg
        className="w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {/* Gradient fill */}
        <defs>
          <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Fill area */}
        <path
          d={`${pathData} L 100 100 L 0 100 Z`}
          fill="url(#chartGradient)"
        />
        
        {/* Line */}
        <path
          d={pathData}
          fill="none"
          stroke="#06b6d4"
          strokeWidth="0.7"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

export default function HomePage() {
  const publicClient = usePublicClient();
  const [totalVolume, setTotalVolume] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!publicClient) return;

    const fetchVolume = async () => {
      try {
        // Get next order ID
        const nextId = await publicClient.readContract({
          address: ORDERBOOK_ADDRESS,
          abi: ESCROW_ORDERBOOK_ABI,
          functionName: "nextId",
        }) as bigint;

        // Fetch all orders and calculate total volume
        let volume = 0;
        const orderPromises: Promise<void>[] = [];
        
        for (let i = 1n; i < nextId; i++) {
          const orderPromise = (async (orderId: bigint) => {
            try {
              const orderData = await publicClient.readContract({
                address: ORDERBOOK_ADDRESS,
                abi: ESCROW_ORDERBOOK_ABI,
                functionName: "orders",
                args: [orderId],
              }) as readonly [bigint, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, bigint, bigint, bigint, bigint, bigint, boolean, number];

              const amount = orderData[5];
              const unitPrice = orderData[6];
              const status = orderData[11];

              // Only count filled orders (FUNDED=1, SETTLED=2, DEFAULTED=3, CANCELED=4)
              // Actually for volume we want FUNDED(1) and SETTLED(2)
              if (status === 1 || status === 2) {
                const amountFloat = parseFloat(formatUnits(amount, 18));
                const priceFloat = parseFloat(formatUnits(unitPrice, STABLE_DECIMALS));
                volume += amountFloat * priceFloat;
              }
            } catch (err) {
              // Silent fail for individual orders
            }
          })(i);
          
          orderPromises.push(orderPromise);
        }
        
        await Promise.all(orderPromises);
        setTotalVolume(volume);
      } catch (error) {
        console.error("Error fetching volume:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchVolume();
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchVolume, 60000);
    return () => clearInterval(interval);
  }, [publicClient]);

  return (
    <main className="relative min-h-[calc(100vh-80px)] overflow-hidden">
      {/* Tech grid background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-20"></div>
      
      {/* Animated chart background */}
      <AnimatedChart />
      
      {/* Hero Section */}
      <div className="relative mx-auto max-w-6xl px-4 py-20 md:py-32">
        <div className="flex flex-col items-center text-center space-y-12">
          {/* Main heading */}
          <div className="flex flex-col items-center space-y-6">
            <Logo variant="full" className="h-20 md:h-28 w-auto" />
            <p className="text-2xl md:text-3xl font-semibold text-zinc-200">
              Decentralized OTC Marketplace
            </p>
            <p className="text-lg text-zinc-400 max-w-2xl">
              Trade pre-TGE tokens & points with secure on-chain escrow.
              No middlemen. No trust required.
            </p>
          </div>

          {/* Features grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
            <div className="glass rounded-2xl p-6 hover:scale-105 transform transition-transform group">
              <div className="mb-4 inline-block p-2.5 bg-cyan-500/10 rounded-lg border border-cyan-500/20 group-hover:border-cyan-500/40 transition-colors">
                <Shield className="w-6 h-6 text-cyan-400" strokeWidth={1.5} />
              </div>
              <h3 className="font-semibold text-lg mb-2">Secure Escrow</h3>
              <p className="text-sm text-zinc-400">
                Both parties lock collateral on-chain for guaranteed settlement
              </p>
            </div>
            <div className="glass rounded-2xl p-6 hover:scale-105 transform transition-transform group">
              <div className="mb-4 inline-block p-2.5 bg-violet-500/10 rounded-lg border border-violet-500/20 group-hover:border-violet-500/40 transition-colors">
                <Zap className="w-6 h-6 text-violet-400" strokeWidth={1.5} />
              </div>
              <h3 className="font-semibold text-lg mb-2">Instant Trading</h3>
              <p className="text-sm text-zinc-400">
                Create orders and match with buyers/sellers in seconds
              </p>
            </div>
            <div className="glass rounded-2xl p-6 hover:scale-105 transform transition-transform group">
              <div className="mb-4 inline-block p-2.5 bg-pink-500/10 rounded-lg border border-pink-500/20 group-hover:border-pink-500/40 transition-colors">
                <TrendingUp className="w-6 h-6 text-pink-400" strokeWidth={1.5} />
              </div>
              <h3 className="font-semibold text-lg mb-2">Live Price Data</h3>
              <p className="text-sm text-zinc-400">
                Real-time charts and best bid/ask prices for all projects
              </p>
            </div>
          </div>

          {/* CTA buttons */}
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/markets">
              <Button
                variant="custom"
                className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-700 hover:to-cyan-700 text-base px-6 py-3 shadow-lg shadow-violet-500/30 flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                Browse Markets
              </Button>
            </Link>
            <Link href="/private-order">
              <Button
                variant="custom"
                className="bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700 text-base px-8 py-3 flex items-center gap-2"
              >
                <Lock className="w-4 h-4" />
                Private Orders
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="flex justify-center gap-16 text-center">
            <div>
              <div className="text-3xl font-bold text-cyan-400/70">100%</div>
              <div className="text-sm text-zinc-500">Escrow</div>
            </div>
            <div className="w-px bg-zinc-800"></div>
            <div>
              <div className="text-3xl font-bold text-violet-400/70">
                {loading ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  `$${totalVolume.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                )}
              </div>
              <div className="text-sm text-zinc-500">Total Volume</div>
            </div>
            <div className="w-px bg-zinc-800"></div>
            <div>
              <div className="text-3xl font-bold text-pink-400/70">24/7</div>
              <div className="text-sm text-zinc-500">Available</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
