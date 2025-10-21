"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/Logo";
import { Shield, Zap, TrendingUp } from "lucide-react";

export default function HomePage() {
  return (
    <main className="relative min-h-[calc(100vh-80px)] overflow-hidden">
      {/* Tech grid background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-20"></div>
      
      {/* Animated scanning lines */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute h-px w-full bg-gradient-to-r from-transparent via-cyan-500 to-transparent animate-scan-horizontal" style={{ top: '20%' }}></div>
        <div className="absolute h-px w-full bg-gradient-to-r from-transparent via-violet-500 to-transparent animate-scan-horizontal" style={{ top: '60%', animationDelay: '3s' }}></div>
        <div className="absolute w-px h-full bg-gradient-to-b from-transparent via-cyan-500 to-transparent animate-scan-vertical" style={{ left: '30%' }}></div>
        <div className="absolute w-px h-full bg-gradient-to-b from-transparent via-violet-500 to-transparent animate-scan-vertical" style={{ left: '70%', animationDelay: '2s' }}></div>
      </div>
      
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-32 h-32 border-t-2 border-l-2 border-cyan-500/30"></div>
      <div className="absolute top-0 right-0 w-32 h-32 border-t-2 border-r-2 border-violet-500/30"></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 border-b-2 border-l-2 border-violet-500/30"></div>
      <div className="absolute bottom-0 right-0 w-32 h-32 border-b-2 border-r-2 border-cyan-500/30"></div>
      
      {/* Hero Section */}
      <div className="relative mx-auto max-w-6xl px-4 py-20 md:py-32">
        <div className="text-center space-y-8">
          {/* Main heading */}
          <div className="space-y-4">
            <div className="flex justify-center mb-6">
              <Logo className="w-24 h-24 md:w-32 md:h-32 animate-pulse" />
            </div>
            <h1 className="text-6xl md:text-8xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-gradient">
              otcX
            </h1>
            <p className="text-2xl md:text-3xl font-semibold text-zinc-200">
              Decentralized OTC Marketplace
            </p>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
              Trade pre-TGE tokens & points with secure on-chain escrow.
              No middlemen. No trust required.
            </p>
          </div>

          {/* Features grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 max-w-4xl mx-auto">
            <div className="glass rounded-2xl p-6 hover:scale-105 transform transition-transform group">
              <div className="mb-4 inline-block p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20 group-hover:border-cyan-500/40 transition-colors">
                <Shield className="w-8 h-8 text-cyan-400" strokeWidth={1.5} />
              </div>
              <h3 className="font-semibold text-lg mb-2">Secure Escrow</h3>
              <p className="text-sm text-zinc-400">
                Both parties lock collateral on-chain for guaranteed settlement
              </p>
            </div>
            <div className="glass rounded-2xl p-6 hover:scale-105 transform transition-transform group">
              <div className="mb-4 inline-block p-3 bg-violet-500/10 rounded-lg border border-violet-500/20 group-hover:border-violet-500/40 transition-colors">
                <Zap className="w-8 h-8 text-violet-400" strokeWidth={1.5} />
              </div>
              <h3 className="font-semibold text-lg mb-2">Instant Trading</h3>
              <p className="text-sm text-zinc-400">
                Create orders and match with buyers/sellers in seconds
              </p>
            </div>
            <div className="glass rounded-2xl p-6 hover:scale-105 transform transition-transform group">
              <div className="mb-4 inline-block p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20 group-hover:border-cyan-500/40 transition-colors">
                <TrendingUp className="w-8 h-8 text-cyan-400" strokeWidth={1.5} />
              </div>
              <h3 className="font-semibold text-lg mb-2">Live Price Data</h3>
              <p className="text-sm text-zinc-400">
                Real-time charts and best bid/ask prices for all projects
              </p>
            </div>
          </div>

          {/* CTA buttons */}
          <div className="flex gap-4 justify-center mt-12 flex-wrap">
            <Link href="/app">
              <Button
                variant="custom"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-base px-8 py-3 shadow-lg shadow-blue-500/50"
              >
                Browse Markets →
              </Button>
            </Link>
            <Link href="/my">
              <Button
                variant="custom"
                className="bg-zinc-800 hover:bg-zinc-700 text-base px-8 py-3"
              >
                My Orders
              </Button>
            </Link>
            <Link href="/how-it-works">
              <Button
                variant="custom"
                className="bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700 text-base px-8 py-3"
              >
                📚 How It Works
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="flex justify-center gap-8 mt-16 text-center">
            <div>
              <div className="text-3xl font-bold text-cyan-400">100%</div>
              <div className="text-sm text-zinc-500">Escrow</div>
            </div>
            <div className="w-px bg-zinc-800"></div>
            <div>
              <div className="text-3xl font-bold text-violet-400">0%</div>
              <div className="text-sm text-zinc-500">Fees</div>
            </div>
            <div className="w-px bg-zinc-800"></div>
            <div>
              <div className="text-3xl font-bold text-pink-400">24/7</div>
              <div className="text-sm text-zinc-500">Available</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
