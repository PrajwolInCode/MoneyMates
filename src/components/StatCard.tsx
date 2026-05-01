import type { LucideIcon } from "lucide-react";
import clsx from "clsx";
import { Card } from "./Card";

type StatCardProps = {
  title: string;
  value: string;
  detail?: string;
  icon?: LucideIcon;
  tone?: "default" | "good" | "warn" | "danger";
};

export function StatCard({ title, value, detail, icon: Icon, tone = "default" }: StatCardProps) {
  return (
    <Card className="min-h-32">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink/60">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-normal text-ink">{value}</p>
        </div>
        {Icon ? (
          <div
            className={clsx(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
              tone === "good" && "bg-sage text-moss",
              tone === "warn" && "bg-gold/15 text-gold",
              tone === "danger" && "bg-coral/15 text-coral",
              tone === "default" && "bg-sage/80 text-navy",
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        ) : null}
      </div>
      {detail ? <p className="mt-3 text-sm leading-5 text-ink/65">{detail}</p> : null}
    </Card>
  );
}
