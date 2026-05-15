import type { ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import clsx from "clsx";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  size?: "sm" | "md";
};

export function Button({ className, children, variant = "primary", loading, disabled, size = "md", ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-tightish transition-[transform,background-color,box-shadow,color] duration-150",
        "focus:outline-none focus-visible:shadow-focus active:translate-y-px",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0",
        size === "sm" ? "min-h-9 px-3 py-1.5 text-[13px]" : "min-h-11 px-4 py-2 text-sm",
        variant === "primary" && "bg-navy text-white shadow-elevated hover:bg-ink",
        variant === "secondary" && "border border-sage bg-white text-ink hover:border-moss hover:bg-mist",
        variant === "ghost" && "text-ink/80 hover:bg-sage/50 hover:text-ink",
        variant === "danger" && "bg-coral text-white shadow-elevated hover:brightness-95",
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
