import { Compass, Flame, Rocket, Sparkles, Sprout, TrendingUp } from "lucide-react";
import { Card } from "./Card";
import { currency } from "../lib/format";

type FreedomTier = {
  label: string;
  description: string;
  Icon: typeof Sprout;
  accent: string;
};

function tierForRate(rate: number): FreedomTier {
  if (rate >= 0.5) return {
    label: "FIRE path",
    description: "Half your income builds wealth. You're moving fast toward financial independence.",
    Icon: Rocket,
    accent: "bg-navy text-white",
  };
  if (rate >= 0.3) return {
    label: "Strong saver",
    description: "30%+ of income is building net worth. Keep stacking and you'll hit serious milestones.",
    Icon: Flame,
    accent: "bg-moss text-white",
  };
  if (rate >= 0.2) return {
    label: "On track",
    description: "1 in 5 dollars is building wealth. A great rhythm for long-term freedom.",
    Icon: TrendingUp,
    accent: "bg-mint text-moss",
  };
  if (rate >= 0.1) return {
    label: "Building",
    description: "You're saving consistently. Aim for 20% to accelerate your timeline.",
    Icon: Compass,
    accent: "bg-sage text-moss",
  };
  if (rate > 0) return {
    label: "Getting started",
    description: "Every dollar saved is one step closer. Try lifting your savings rate above 10%.",
    Icon: Sprout,
    accent: "bg-mist text-ink/70",
  };
  return {
    label: "Plant the seed",
    description: "Set a small savings goal in Budget — even 5% builds the habit that compounds.",
    Icon: Sparkles,
    accent: "bg-mist text-ink/70",
  };
}

type Props = {
  monthlyIncome: number;
  monthlySavings: number;
  monthlyDebtPaydown: number;
  monthlyPlannedExpenses: number;
};

export function FinancialFreedomCard({
  monthlyIncome,
  monthlySavings,
  monthlyDebtPaydown,
  monthlyPlannedExpenses,
}: Props) {
  if (monthlyIncome <= 0 && monthlySavings <= 0 && monthlyDebtPaydown <= 0) {
    return null;
  }

  const wealthBuild = Math.max(0, monthlySavings + monthlyDebtPaydown);
  const freedomRate = monthlyIncome > 0 ? wealthBuild / monthlyIncome : 0;
  const surplus = monthlyIncome - monthlyPlannedExpenses;
  const annualWealthBuild = wealthBuild * 12;
  const tier = tierForRate(freedomRate);
  const Icon = tier.Icon;
  const ratePercent = Math.min(100, Math.round(freedomRate * 100));
  const targetMarker = Math.min(100, Math.max(0, Math.round((0.2 / Math.max(0.5, freedomRate || 0.2)) * 50)));

  return (
    <Card className="mb-5 overflow-hidden">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${tier.accent}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-moss">Financial freedom</p>
            <h2 className="mt-0.5 text-xl font-bold tracking-normal text-ink">{tier.label}</h2>
            <p className="mt-1 max-w-md text-sm leading-5 text-ink/65">{tier.description}</p>
          </div>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3 text-center sm:text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-moss">Wealth-build rate</p>
          <p className="mt-1 text-3xl font-bold text-moss">{ratePercent}%</p>
          <p className="mt-0.5 text-[11px] text-moss/70">of income → savings &amp; debt paydown</p>
        </div>
      </div>

      <div className="mt-5">
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-sage/40">
          <div
            className={`h-full rounded-full transition-all ${
              freedomRate >= 0.3 ? "bg-moss" : freedomRate >= 0.2 ? "bg-navy" : freedomRate >= 0.1 ? "bg-gold" : "bg-coral"
            }`}
            style={{ width: `${Math.max(2, ratePercent)}%` }}
          />
          <div
            className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-ink/40"
            style={{ left: `${targetMarker}%` }}
            aria-hidden="true"
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] font-semibold text-ink/45">
          <span>0%</span>
          <span>Target 20%+</span>
          <span>50%+ FIRE</span>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl bg-mist px-3 py-2.5">
          <p className="text-xs font-semibold uppercase text-ink/45">Saving / month</p>
          <p className="mt-1 font-bold text-ink">{currency(monthlySavings)}</p>
        </div>
        <div className="rounded-xl bg-mist px-3 py-2.5">
          <p className="text-xs font-semibold uppercase text-ink/45">Debt paydown / month</p>
          <p className="mt-1 font-bold text-ink">{currency(monthlyDebtPaydown)}</p>
        </div>
        <div className="rounded-xl bg-mist px-3 py-2.5">
          <p className="text-xs font-semibold uppercase text-ink/45">Net worth built / year</p>
          <p className="mt-1 font-bold text-ink">{currency(annualWealthBuild)}</p>
        </div>
      </div>

      {monthlyIncome > 0 ? (
        <p className="mt-3 text-xs leading-5 text-ink/55">
          Planned monthly surplus:{" "}
          <span className={`font-semibold ${surplus >= 0 ? "text-moss" : "text-coral"}`}>
            {surplus >= 0 ? currency(surplus) : `${currency(Math.abs(surplus))} short`}
          </span>
          . Add savings or debt items in Budget to grow this number.
        </p>
      ) : null}
    </Card>
  );
}
