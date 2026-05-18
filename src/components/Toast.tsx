import { CheckCircle2, PartyPopper, TriangleAlert } from "lucide-react";

type ToastProps = {
  message: string;
  tone?: "success" | "error" | "praise";
};

export function Toast({ message, tone = "success" }: ToastProps) {
  if (tone === "praise") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mm-dialog-panel pointer-events-none fixed left-4 right-4 top-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-moss/30 bg-gradient-to-r from-mint via-white to-mint px-4 py-3 text-sm font-semibold text-moss shadow-soft sm:top-6"
      >
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-moss text-white shadow-elevated">
          <PartyPopper className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <span className="leading-5">{message}</span>
      </div>
    );
  }

  const Icon = tone === "success" ? CheckCircle2 : TriangleAlert;
  return (
    <div
      role="status"
      aria-live="polite"
      className="mm-dialog-panel fixed left-4 right-4 top-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white shadow-soft sm:top-6"
    >
      <Icon className={`h-5 w-5 shrink-0 ${tone === "success" ? "text-sage" : "text-coral"}`} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
