import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, X } from "lucide-react";
import { useHousehold } from "../contexts/HouseholdContext";
import { monthlyAmountForBudgetItem, totalBudgetItemMonthlyIncome, totalBudgetItemMonthlyPlannedExpenses, totalSpent } from "../lib/budget";
import { currency } from "../lib/format";
import type { BudgetItem } from "../types";

const CHECK_IN_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000;

function itemTotal(items: BudgetItem[], predicate: (item: BudgetItem) => boolean) {
  return items.filter(predicate).reduce((sum, item) => sum + (monthlyAmountForBudgetItem(item) ?? 0), 0);
}

export function MoneyCheckInPrompt() {
  const { household, budgetItems, expenses } = useHousehold();
  const [visible, setVisible] = useState(false);

  const activeItems = useMemo(() => budgetItems.filter((item) => item.is_active && !item.archived_at), [budgetItems]);
  const income = totalBudgetItemMonthlyIncome(activeItems);
  const planned = totalBudgetItemMonthlyPlannedExpenses(activeItems);
  const savings = itemTotal(activeItems, (item) => item.type === "saving" || item.type === "buffer");
  const spent = totalSpent(expenses);
  const expectedRemaining = income - planned;
  const actualFlowLeft = income - spent;
  const isAhead = income > 0 && expectedRemaining >= 0 && actualFlowLeft >= Math.max(0, expectedRemaining * 0.5);
  const storageKey = household ? `moneymates-money-check-in-${household.id}` : "moneymates-money-check-in";

  useEffect(() => {
    if (!household || income <= 0 || (!planned && !spent)) return;
    const lastShown = Number(window.localStorage.getItem(storageKey) ?? 0);
    if (!lastShown || Date.now() - lastShown > CHECK_IN_INTERVAL_MS) {
      const timeout = window.setTimeout(() => setVisible(true), 1200);
      return () => window.clearTimeout(timeout);
    }
  }, [household, income, planned, spent, storageKey]);

  const dismiss = (days = 3) => {
    window.localStorage.setItem(storageKey, String(Date.now() - CHECK_IN_INTERVAL_MS + days * 24 * 60 * 60 * 1000));
    setVisible(false);
  };

  if (!visible) return null;

  const questions = isAhead
    ? [
        `Can you protect ${currency(Math.max(0, Math.min(expectedRemaining, savings || expectedRemaining)))} before increasing spending?`,
        "Is there one bill or shared cost you can make easier for next month?",
        "What small reward would feel good without weakening the plan?",
      ]
    : [
        "Which needs must be protected before any wants this week?",
        "Is there one flexible item you can pause until the next pay cycle?",
        "Would adding a missing amount make the household picture clearer?",
      ];

  return (
    <div className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-lg rounded-2xl border border-sage bg-white p-4 shadow-soft md:bottom-5 md:right-5 md:left-auto">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-mint p-2 text-moss">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-moss">Money check-in</p>
            <h2 className="mt-1 text-lg font-bold tracking-normal text-ink">
              {isAhead ? "You are doing better. Protect part of the win." : "This month looks tight. Needs first, wants can wait."}
            </h2>
          </div>
        </div>
        <button className="rounded-xl border border-sage p-2 text-ink/60" type="button" aria-label="Dismiss money check-in" onClick={() => dismiss(1)}>
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-3 grid gap-2 text-sm leading-6 text-ink/70">
        {questions.map((question) => (
          <p key={question} className="rounded-xl bg-mist px-3 py-2">
            {question}
          </p>
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Link className="inline-flex min-h-10 items-center justify-center rounded-xl bg-navy px-3 py-2 text-sm font-semibold text-white" to="/insights" onClick={() => dismiss(3)}>
          Ask Coach
        </Link>
        <button className="inline-flex min-h-10 items-center justify-center rounded-xl border border-sage px-3 py-2 text-sm font-semibold text-ink" type="button" onClick={() => dismiss(7)}>
          I checked it
        </button>
      </div>
    </div>
  );
}
