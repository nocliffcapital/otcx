"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/Logo";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <main className="relative min-h-screen overflow-hidden flex items-center justify-center" style={{ backgroundColor: '#06060c' }}>
      {/* Tech grid background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
      
      {/* Content */}
      <div className="relative z-10 mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="flex flex-col items-center space-y-6">
          {/* Logo */}
          <Logo variant="full" className="h-16 w-auto opacity-50" />
          
          {/* 404 */}
          <div className="relative">
            <h1 className="text-9xl font-bold text-white">
              404
            </h1>
            <div className="absolute inset-0 blur-3xl bg-[#2b2b30]/30 -z-10"></div>
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
                className="border font-mono px-6 py-3 flex items-center gap-2"
                style={{ backgroundColor: '#2b2b30', borderColor: '#2b2b30', color: 'white' }}
              >
                <Home className="w-4 h-4" />
                Go Home
              </Button>
            </Link>
            <Link href="/">
              <Button
                variant="custom"
                className="border font-mono px-6 py-3 flex items-center gap-2"
                style={{ backgroundColor: '#121218', borderColor: '#2b2b30', color: 'white' }}
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
              <Link href="/" className="text-xs text-zinc-400 hover:text-zinc-300 transition-colors px-3 py-1 rounded border" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
                Markets
              </Link>
              <Link href="/dashboard" className="text-xs text-zinc-400 hover:text-zinc-300 transition-colors px-3 py-1 rounded border" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
                Dashboard
              </Link>
              <Link href="/calculator" className="text-xs text-zinc-400 hover:text-zinc-300 transition-colors px-3 py-1 rounded border" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
                Calculator
              </Link>
              <Link href="/how-it-works" className="text-xs text-zinc-400 hover:text-zinc-300 transition-colors px-3 py-1 rounded border" style={{ backgroundColor: '#121218', borderColor: '#2b2b30' }}>
                How It Works
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

