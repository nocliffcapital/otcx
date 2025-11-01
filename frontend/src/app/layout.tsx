"use client";

import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";
import { ReactNode, useState, useEffect } from "react";
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

  useEffect(() => {
    // Dynamically add favicon links
    const faviconUrl = "https://turquoise-keen-koi-739.mypinata.cloud/ipfs/bafkreihj7gupr4tgotsrrdnex777npp5gbmlqujxkkrouaeekea4q7kjcy";

    // Remove any existing favicons
    const existingFavicons = document.querySelectorAll('link[rel*="icon"]');
    existingFavicons.forEach(link => link.remove());

    // Add new favicon links
    const link32 = document.createElement('link');
    link32.rel = 'icon';
    link32.type = 'image/png';
    link32.sizes = '32x32';
    link32.href = faviconUrl;
    document.head.appendChild(link32);

    const link16 = document.createElement('link');
    link16.rel = 'icon';
    link16.type = 'image/png';
    link16.sizes = '16x16';
    link16.href = faviconUrl;
    document.head.appendChild(link16);

    const linkShortcut = document.createElement('link');
    linkShortcut.rel = 'shortcut icon';
    linkShortcut.href = faviconUrl;
    document.head.appendChild(linkShortcut);
  }, []);

  return (
    <html lang="en" className="h-full">
      <head>
        <title>otcX - Decentralized OTC Marketplace</title>
        <meta name="description" content="Trade pre-TGE tokens & points with secure on-chain escrow. No middlemen. No trust required." />

        <meta name="viewport" content="width=device-width, initial-scale=1" />

        {/* Open Graph / Facebook / LinkedIn / Telegram */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://otcx.trade" />
        <meta property="og:title" content="otcX - Decentralized OTC Marketplace" />
        <meta property="og:description" content="Trade pre-TGE tokens & points with secure on-chain escrow. No middlemen. No trust required." />
        <meta property="og:image" content="https://turquoise-keen-koi-739.mypinata.cloud/ipfs/bafkreigjbxg3uzqm25i4htyl6hk4s7j5ik4lva4uwemjboutmgonplvn4u" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="otcX - Decentralized OTC Trading Platform" />
        <meta property="og:site_name" content="otcX" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://otcx.trade" />
        <meta name="twitter:title" content="otcX - Decentralized OTC Marketplace" />
        <meta name="twitter:description" content="Trade pre-TGE tokens & points with secure on-chain escrow. No middlemen. No trust required." />
        <meta name="twitter:image" content="https://turquoise-keen-koi-739.mypinata.cloud/ipfs/bafkreigjbxg3uzqm25i4htyl6hk4s7j5ik4lva4uwemjboutmgonplvn4u" />
        <meta name="twitter:image:alt" content="otcX - Decentralized OTC Trading Platform" />
      </head>
      <body className={`min-h-screen text-zinc-100 ${spaceGrotesk.variable} font-sans relative`} style={{ backgroundColor: '#06060c' }}>
        {/* Tech grid background for all pages */}
        <div className="fixed inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
        
        {/* Cursor spotlight effect */}
        <CursorSpotlight />
        
        {/* Global SVG gradient for icons */}
        <svg width="0" height="0" style={{ position: 'absolute' }}>
          <defs>
            <linearGradient id="icon-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: '#22d3ee' }} />
              <stop offset="100%" style={{ stopColor: '#a78bfa' }} />
            </linearGradient>
          </defs>
        </svg>
        
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
