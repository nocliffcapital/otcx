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
        
        {/* Favicons */}
        <link rel="icon" type="image/png" sizes="32x32" href="https://dweb.link/ipfs/bafkreibkhmzwv2yt5vbyvf4ptl4fc44hte2hmumjaap6oo55l65xquvxre" />
        <link rel="icon" type="image/png" sizes="16x16" href="https://dweb.link/ipfs/bafkreibkhmzwv2yt5vbyvf4ptl4fc44hte2hmumjaap6oo55l65xquvxre" />
        <link rel="shortcut icon" href="https://dweb.link/ipfs/bafkreibkhmzwv2yt5vbyvf4ptl4fc44hte2hmumjaap6oo55l65xquvxre" />
        
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        
        {/* Open Graph / Facebook / LinkedIn / Telegram */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://otcx.trade" />
        <meta property="og:title" content="otcX - Decentralized OTC Marketplace" />
        <meta property="og:description" content="Trade pre-TGE tokens & points with secure on-chain escrow. No middlemen. No trust required." />
        <meta property="og:image" content="https://dweb.link/ipfs/bafkreial2uizk25jdkkmjwftasl7wmqwkfiyicqwpjngqjlrinvbqbxrzu" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="otcX - Decentralized OTC Trading Platform" />
        <meta property="og:site_name" content="otcX" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://otcx.trade" />
        <meta name="twitter:title" content="otcX - Decentralized OTC Marketplace" />
        <meta name="twitter:description" content="Trade pre-TGE tokens & points with secure on-chain escrow. No middlemen. No trust required." />
        <meta name="twitter:image" content="https://dweb.link/ipfs/bafkreial2uizk25jdkkmjwftasl7wmqwkfiyicqwpjngqjlrinvbqbxrzu" />
        <meta name="twitter:image:alt" content="otcX - Decentralized OTC Trading Platform" />
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
