import type { LucideIcon } from "lucide-react";
import { CircleDollarSign } from "lucide-react";

type EmptyStateProps = {
  title: string;
  message: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
};

export function EmptyState({ title, message, icon: Icon = CircleDollarSign, action }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-sage bg-white/70 p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sage text-navy">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink/65">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
