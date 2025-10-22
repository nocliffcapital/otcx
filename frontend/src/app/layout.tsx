"use client";

import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";
import { ReactNode, useState } from "react";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ToastProvider } from "@/components/Toast";
import { CursorSpotlight } from "@/components/CursorSpotlight";
import { Space_Grotesk } from "next/font/google";

const spaceGrotesk = Space_Grotesk({ 
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export default function RootLayout({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <html lang="en" className="h-full">
      <head>
        <title>otcX - Decentralized OTC Marketplace</title>
        <meta name="description" content="Trade pre-TGE tokens & points with secure on-chain escrow. No middlemen. No trust required." />
        <link rel="icon" href="https://cloudflare-ipfs.com/ipfs/bafkreig4bsrihy2gc6voorpv46x5us2gjesizcbarhh4u74b26t3ez27wq" type="image/png" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:title" content="otcX - Decentralized OTC Marketplace" />
        <meta property="og:description" content="Trade pre-TGE tokens & points with secure on-chain escrow." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </head>
      <body className={`min-h-screen bg-gradient-to-b from-zinc-950 to-black text-zinc-100 ${spaceGrotesk.variable} font-sans relative`}>
        {/* Tech grid background for all pages */}
        <div className="fixed inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
        
        {/* Cursor spotlight effect */}
        <CursorSpotlight />
        
        <div className="relative z-10 pb-20">
          <WagmiProvider config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>
              <RainbowKitProvider 
                theme={darkTheme({
                  accentColor: '#06b6d4', // cyan-500
                  accentColorForeground: 'white',
                  borderRadius: 'large',
                  fontStack: 'system',
                  overlayBlur: 'small',
                })}
                modalSize="compact"
              >
                <ToastProvider>
                  <Navbar />
                  {children}
                  <Footer />
                </ToastProvider>
              </RainbowKitProvider>
            </QueryClientProvider>
          </WagmiProvider>
        </div>
      </body>
    </html>
  );
}
