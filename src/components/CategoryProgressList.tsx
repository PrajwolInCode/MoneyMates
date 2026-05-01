import type { BudgetLimit, Category, Expense } from "../types";
import { spendingByCategory } from "../lib/budget";
import { currency, percent } from "../lib/format";
import { EmptyState } from "./EmptyState";
import { ProgressBar } from "./ProgressBar";
import { WarningBanner } from "./WarningBanner";

type CategoryProgressListProps = {
  expenses: Expense[];
  categories: Category[];
  limits: BudgetLimit[];
};

export function CategoryProgressList({ expenses, categories, limits }: CategoryProgressListProps) {
  const rows = spendingByCategory(expenses, categories, limits);

  if (!rows.length) {
    return <EmptyState title="No category activity yet" message="Add an expense or set a category limit to see progress here." />;
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const percentage = row.limit > 0 ? row.spent / row.limit : 0;
        return (
          <div key={row.id} className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">{row.category}</p>
                <p className="text-xs text-ink/60">
                  {currency(row.spent)} spent{row.limit > 0 ? ` of ${currency(row.limit)}` : ""}
                </p>
              </div>
              <p className="text-sm font-semibold text-ink">{row.limit > 0 ? percent(percentage) : currency(row.spent)}</p>
            </div>
            <ProgressBar value={percentage * 100} />
            {row.limit > 0 && percentage >= 1 ? (
              <WarningBanner tone="strong">
                {row.category} is over its plan. Pause, choose one small adjustment, and keep the next spend intentional.
              </WarningBanner>
            ) : row.limit > 0 && percentage >= 0.8 ? (
              <WarningBanner>{row.category} is at 80% of its plan. A gentle check-in now can protect the rest of the month.</WarningBanner>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
