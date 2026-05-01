import { Info, TriangleAlert } from "lucide-react";
import clsx from "clsx";

type WarningBannerProps = {
  tone?: "soft" | "strong";
  children: React.ReactNode;
};

export function WarningBanner({ tone = "soft", children }: WarningBannerProps) {
  const Icon = tone === "strong" ? TriangleAlert : Info;
  return (
    <div
      className={clsx(
        "flex gap-3 rounded-2xl border p-4 text-sm leading-5",
        tone === "strong" ? "border-coral/30 bg-coral/10 text-ink" : "border-gold/30 bg-gold/10 text-ink",
      )}
    >
      <Icon className={clsx("mt-0.5 h-5 w-5 shrink-0", tone === "strong" ? "text-coral" : "text-gold")} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
