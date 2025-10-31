import { InputHTMLAttributes } from "react";
import clsx from "clsx";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "w-full rounded border text-zinc-100 px-3 py-2 text-sm placeholder-zinc-400 focus:outline-none font-mono",
        className
      )}
      style={{
        backgroundColor: '#121218',
        borderColor: '#2b2b30',
        ...((props as any).style || {})
      }}
      {...props}
    />
  );
}

