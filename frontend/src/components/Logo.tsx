"use client";

import Image from "next/image";

interface LogoProps {
  className?: string;
  variant?: "full" | "icon";
}

export function Logo({ className = "w-8 h-8", variant = "icon" }: LogoProps) {
  const logoUrl = "https://gateway.pinata.cloud/ipfs/bafkreieqn4lxr26ngwk3abyhty5veut2svhc7mroy2h3ucmbunrhspb2iq";
  const iconUrl = "https://gateway.pinata.cloud/ipfs/bafkreig4bsrihy2gc6voorpv46x5us2gjesizcbarhh4u74b26t3ez27wq";
  
  return (
    <img
      src={variant === "full" ? logoUrl : iconUrl}
      alt="otcX"
      className={className}
    />
  );
}

