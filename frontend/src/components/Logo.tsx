"use client";

import Image from "next/image";

interface LogoProps {
  className?: string;
  variant?: "full" | "icon";
}

export function Logo({ className = "w-8 h-8", variant = "icon" }: LogoProps) {
  const logoUrl = "https://dweb.link/ipfs/bafkreibt2ucqwtni2lrl7yaecojdjk3d3impzctrdqdgheb36oj46pdslm";
  const iconUrl = "https://dweb.link/ipfs/bafkreig4bsrihy2gc6voorpv46x5us2gjesizcbarhh4u74b26t3ez27wq";
  
  return (
    <img
      src={variant === "full" ? logoUrl : iconUrl}
      alt="otcX"
      className={className}
    />
  );
}

