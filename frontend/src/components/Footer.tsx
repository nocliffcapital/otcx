"use client";

import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 border-t border-zinc-800/50 bg-zinc-950/80 backdrop-blur-xl z-40">
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Left: Live Data Indicator */}
          <div className="flex items-center gap-2">
            <div className="relative flex items-center">
              <div className="absolute w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
              <div className="relative w-2 h-2 bg-green-500 rounded-full"></div>
            </div>
            <span className="text-xs text-zinc-400 font-medium">Live Data</span>
          </div>

          {/* Center: Logo */}
          <div className="flex justify-center">
            <Logo variant="full" className="h-6 w-auto opacity-80 hover:opacity-100 transition-opacity" />
          </div>

          {/* Right: Links */}
          <div className="flex items-center gap-4">
            {/* Docs */}
            <a
              href="https://docs.otcx.fun"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
              <span className="font-medium">Docs</span>
            </a>

            {/* Telegram */}
            <a
              href="https://t.me/otc_fun"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-blue-400 transition-colors group"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="group-hover:text-blue-400"
              >
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z" />
              </svg>
              <span className="font-medium">Telegram</span>
            </a>

            {/* Twitter/X */}
            <a
              href="https://x.com/otc_fun"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors group"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="group-hover:text-white"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span className="font-medium">X</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

