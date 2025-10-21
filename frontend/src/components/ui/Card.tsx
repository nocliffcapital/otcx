import { HTMLAttributes } from "react";
import clsx from "clsx";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-zinc-800/50 bg-gradient-to-br from-zinc-900/90 to-zinc-900/50 backdrop-blur-xl p-6 shadow-xl hover:shadow-2xl hover:border-zinc-700/50 transition-all duration-300",
        className
      )}
      {...props}
    />
  );
}

