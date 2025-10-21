"use client";

export function Logo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      
      {/* Outer ring - representing "circle" of OTC */}
      <circle
        cx="50"
        cy="50"
        r="40"
        stroke="url(#logoGradient)"
        strokeWidth="6"
        fill="none"
        opacity="0.8"
      />
      
      {/* Inner X - stylized exchange symbol */}
      <path
        d="M 30 30 L 70 70 M 70 30 L 30 70"
        stroke="url(#logoGradient)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

