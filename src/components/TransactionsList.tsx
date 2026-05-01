import { ReceiptText } from "lucide-react";
import type { Expense } from "../types";
import { formatShortDate } from "../lib/date";
import { currency, personName } from "../lib/format";
import { EmptyState } from "./EmptyState";

type TransactionsListProps = {
  expenses: Expense[];
  limit?: number;
};

export function TransactionsList({ expenses, limit }: TransactionsListProps) {
  const rows = limit ? expenses.slice(0, limit) : expenses;

  if (!rows.length) {
    return <EmptyState icon={ReceiptText} title="No expenses yet" message="Your first saved expense will appear here with who added it." />;
  }

  return (
    <div className="divide-y divide-sage/70">
      {rows.map((expense) => (
        <div key={expense.id} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{expense.merchant || expense.category?.name || "Expense"}</p>
            <p className="text-sm text-ink/60">
              {formatShortDate(expense.spent_on)} · {expense.category?.name ?? "Category"} · Added by{" "}
              {personName(expense.profile?.display_name, expense.profile?.email ?? "Housemate")}
            </p>
          </div>
          <p className="shrink-0 font-semibold text-ink">{currency(Number(expense.amount))}</p>
        </div>
      ))}
    </div>
  );
}
