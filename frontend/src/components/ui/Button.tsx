import { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "sm" | "md" | "lg";
  variant?: "default" | "custom";
}

export function Button({ className, size = "md", variant = "default", ...props }: ButtonProps) {
  const defaultStyle = variant === "default" ? {
    backgroundColor: '#2b2b30',
    borderColor: '#2b2b30',
  } : {};

  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center rounded text-white font-medium font-mono disabled:opacity-50 disabled:cursor-not-allowed transition-all border",
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4 py-2 text-sm",
        size === "lg" && "px-6 py-3 text-base",
        className
      )}
      style={{
        ...defaultStyle,
        ...((props as any).style || {})
      }}
      {...props}
    />
  );
}
