"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/Logo";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <main className="relative min-h-screen overflow-hidden flex items-center justify-center">
      {/* Tech grid background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-20"></div>
      
      {/* Animated scanning lines */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute h-px w-full bg-gradient-to-r from-transparent via-red-500 to-transparent animate-scan-horizontal" style={{ top: '20%' }}></div>
        <div className="absolute w-px h-full bg-gradient-to-b from-transparent via-red-500 to-transparent animate-scan-vertical" style={{ left: '50%' }}></div>
      </div>
      
      {/* Content */}
      <div className="relative z-10 mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="flex flex-col items-center space-y-6">
          {/* Logo */}
          <Logo variant="full" className="h-16 w-auto opacity-50" />
          
          {/* 404 */}
          <div className="relative">
            <h1 className="text-9xl font-bold bg-gradient-to-r from-red-400 to-violet-400 bg-clip-text text-transparent">
              404
            </h1>
            <div className="absolute inset-0 blur-3xl bg-gradient-to-r from-red-500/30 to-violet-500/30 -z-10"></div>
          </div>
          
          {/* Error message */}
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-zinc-200">
              Page Not Found
            </h2>
            <p className="text-zinc-400 max-w-md">
              The page you're looking for doesn't exist or has been moved.
              Let's get you back on track.
            </p>
          </div>
          
          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-6">
            <Link href="/">
              <Button
                variant="custom"
                className="bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-700 hover:to-violet-700 px-6 py-3 shadow-lg flex items-center gap-2"
              >
                <Home className="w-4 h-4" />
                Go Home
              </Button>
            </Link>
            <Link href="/markets">
              <Button
                variant="custom"
                className="bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 px-6 py-3 flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                Browse Markets
              </Button>
            </Link>
          </div>
          
          {/* Popular links */}
          <div className="pt-8 border-t border-zinc-800/50 mt-8">
            <p className="text-sm text-zinc-500 mb-3">Popular pages:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Link href="/markets" className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors px-3 py-1 rounded-lg bg-zinc-800/30 hover:bg-zinc-800/50">
                Markets
              </Link>
              <Link href="/dashboard" className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors px-3 py-1 rounded-lg bg-zinc-800/30 hover:bg-zinc-800/50">
                Dashboard
              </Link>
              <Link href="/calculator" className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors px-3 py-1 rounded-lg bg-zinc-800/30 hover:bg-zinc-800/50">
                Calculator
              </Link>
              <Link href="/how-it-works" className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors px-3 py-1 rounded-lg bg-zinc-800/30 hover:bg-zinc-800/50">
                How It Works
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

