import { Loader2 } from "lucide-react";

export function LoadingState({ label = "Loading MoneyMates" }: { label?: string }) {
  return (
    <div className="flex min-h-[45vh] items-center justify-center p-8 text-ink/70">
      <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-soft">
        <Loader2 className="h-5 w-5 animate-spin text-moss" aria-hidden="true" />
        <span className="text-sm font-medium">{label}</span>
      </div>
    </div>
  );
}
