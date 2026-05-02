import { CheckCircle2, TriangleAlert } from "lucide-react";

type ToastProps = {
  message: string;
  tone?: "success" | "error";
};

export function Toast({ message, tone = "success" }: ToastProps) {
  const Icon = tone === "success" ? CheckCircle2 : TriangleAlert;
  return (
    <div className="fixed left-4 right-4 top-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white shadow-soft">
      <Icon className={`h-5 w-5 shrink-0 ${tone === "success" ? "text-sage" : "text-coral"}`} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
