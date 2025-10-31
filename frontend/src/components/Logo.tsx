"use client";

import Image from "next/image";

interface LogoProps {
  className?: string;
  variant?: "full" | "icon";
}

export function Logo({ className = "w-8 h-8", variant = "icon" }: LogoProps) {
  const logoUrl = "https://turquoise-keen-koi-739.mypinata.cloud/ipfs/bafkreic2fpx67wbrwspol4yaqrti5fq2v7eaxlwp7o36f4igeos7hyrmmy";
  const iconUrl = "https://turquoise-keen-koi-739.mypinata.cloud/ipfs/bafkreic2fpx67wbrwspol4yaqrti5fq2v7eaxlwp7o36f4igeos7hyrmmy";
  
  return (
    <img
      src={variant === "full" ? logoUrl : iconUrl}
      alt="otcX"
      className={className}
    />
  );
}

