"use client";

import Image from "next/image";

interface LogoProps {
  className?: string;
  variant?: "full" | "icon";
}

export function Logo({ className = "w-8 h-8", variant = "icon" }: LogoProps) {
  const logoUrl = "https://dweb.link/ipfs/bafkreigl53kuhbw5tvj5emburifd7fkgzj5ibzqgv3xh67oervnmp3qnx4";
  const iconUrl = "https://dweb.link/ipfs/bafkreigl53kuhbw5tvj5emburifd7fkgzj5ibzqgv3xh67oervnmp3qnx4";
  
  return (
    <img
      src={variant === "full" ? logoUrl : iconUrl}
      alt="otcX"
      className={className}
    />
  );
}

