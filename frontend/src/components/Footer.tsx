"use client";

import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 border-t backdrop-blur-xl z-40" style={{ borderColor: '#2b2b30', backgroundColor: '#121218' }}>
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="grid grid-cols-3 items-center gap-4">
          {/* Left: Live Data Indicator */}
          <div className="flex items-center gap-2 justify-start">
            <div className="relative flex items-center">
              <div className="absolute w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
              <div className="relative w-2 h-2 bg-green-500 rounded-full"></div>
            </div>
            <span className="text-xs text-zinc-400 font-medium font-mono">LIVE DATA</span>
          </div>

          {/* Center: Logo */}
          <div className="flex justify-center">
            <Logo variant="full" className="h-6 w-auto opacity-80 hover:opacity-100 transition-opacity" />
          </div>

          {/* Right: Links */}
          <div className="flex items-center gap-2 sm:gap-4 justify-end">
            {/* GitHub */}
            <a
              href="https://github.com/nocliffcapital/otcX"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition-colors group"
              title="GitHub"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="group-hover:text-zinc-100"
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              <span className="font-mono font-medium hidden sm:inline">GITHUB</span>
            </a>
            
            {/* Docs */}
            <a
              href="/docs"
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition-colors"
              title="Documentation"
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
              <span className="font-mono font-medium hidden sm:inline">DOCS</span>
            </a>

            {/* Telegram */}
            <a
              href="https://t.me/otc_fun"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition-colors group"
              title="Telegram"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="group-hover:text-zinc-100"
              >
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z" />
              </svg>
              <span className="font-mono font-medium hidden sm:inline">TELEGRAM</span>
            </a>

            {/* Twitter/X */}
            <a
              href="https://x.com/otc_fun"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors group"
              title="X (Twitter)"
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
              <span className="font-mono font-medium hidden sm:inline">X</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

