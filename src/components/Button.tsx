import type { ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import clsx from "clsx";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
};

export function Button({ className, children, variant = "primary", loading, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-navy/25 disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-navy text-white shadow-soft hover:bg-ink",
        variant === "secondary" && "border border-sage bg-white text-ink hover:border-moss",
        variant === "ghost" && "text-ink hover:bg-sage/50",
        variant === "danger" && "bg-coral text-white hover:bg-coral/90",
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
