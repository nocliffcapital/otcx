"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/Logo";
import { Shield, Zap, TrendingUp, BookOpen, Search } from "lucide-react";

export default function HomePage() {
  return (
    <main className="relative min-h-[calc(100vh-80px)] overflow-hidden">
      {/* Tech grid background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-20"></div>
      
      {/* Animated scanning lines */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute h-px w-full bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-scan-horizontal" style={{ top: '20%' }}></div>
        <div className="absolute h-px w-full bg-gradient-to-r from-transparent via-zinc-600 to-transparent animate-scan-horizontal" style={{ top: '60%', animationDelay: '3s' }}></div>
        <div className="absolute w-px h-full bg-gradient-to-b from-transparent via-blue-500 to-transparent animate-scan-vertical" style={{ left: '30%' }}></div>
        <div className="absolute w-px h-full bg-gradient-to-b from-transparent via-zinc-600 to-transparent animate-scan-vertical" style={{ left: '70%', animationDelay: '2s' }}></div>
      </div>
      
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-32 h-32 border-t-2 border-l-2 border-blue-500/30"></div>
      <div className="absolute top-0 right-0 w-32 h-32 border-t-2 border-r-2 border-zinc-600/30"></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 border-b-2 border-l-2 border-zinc-600/30"></div>
      <div className="absolute bottom-0 right-0 w-32 h-32 border-b-2 border-r-2 border-blue-500/30"></div>
      
      {/* Hero Section */}
      <div className="relative mx-auto max-w-6xl px-4 py-20 md:py-32">
        <div className="flex flex-col items-center text-center space-y-8">
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
            <Link href="/how-it-works">
              <Button
                variant="custom"
                className="bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700 text-base px-8 py-3 flex items-center gap-2"
              >
                <BookOpen className="w-4 h-4" />
                How It Works
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="flex justify-center gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-cyan-400">100%</div>
              <div className="text-sm text-zinc-500">Escrow</div>
            </div>
            <div className="w-px bg-zinc-800"></div>
            <div>
              <div className="text-3xl font-bold text-violet-400">$0</div>
              <div className="text-sm text-zinc-500">Volume</div>
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
