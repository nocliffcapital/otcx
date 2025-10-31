import { HTMLAttributes } from "react";
import clsx from "clsx";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded border p-6 transition-all",
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

