import { FormEvent, useMemo, useState } from "react";
import { MessageSquare, ReceiptText } from "lucide-react";
import type { Expense } from "../types";
import { formatShortDate } from "../lib/date";
import { currency, personName } from "../lib/format";
import { EmptyState } from "./EmptyState";
import { useHousehold } from "../contexts/HouseholdContext";

type TransactionsListProps = {
  expenses: Expense[];
  limit?: number;
  emptyTitle?: string;
  emptyMessage?: string;
};

export function TransactionsList({ expenses, limit, emptyTitle = "No expenses yet", emptyMessage = "Your first saved expense will appear here with who added it." }: TransactionsListProps) {
  const { expenseComments, addExpenseComment } = useHousehold();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const rows = limit ? expenses.slice(0, limit) : expenses;

  const commentsByExpense = useMemo(() => {
    return expenseComments.reduce<Record<string, typeof expenseComments>>((acc, item) => {
      if (!acc[item.expense_id]) acc[item.expense_id] = [];
      acc[item.expense_id].push(item);
      return acc;
    }, {});
  }, [expenseComments]);

  if (!rows.length) {
    return <EmptyState icon={ReceiptText} title={emptyTitle} message={emptyMessage} />;
  }

  const submitComment = async (event: FormEvent, expenseId: string) => {
    event.preventDefault();
    const body = drafts[expenseId]?.trim();
    if (!body) return;
    await addExpenseComment(expenseId, body);
    setDrafts((value) => ({ ...value, [expenseId]: "" }));
  };

  return (
    <div className="divide-y divide-sage/70">
      {rows.map((expense) => (
        <div key={expense.id} className="py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{expense.merchant || expense.category?.name || "Expense"}</p>
              <p className="text-sm text-ink/60">
                {formatShortDate(expense.spent_on)} - {expense.category?.name ?? "Category"} - Added by{" "}
                {personName(expense.profile?.display_name, expense.profile?.email ?? "Household member")}
              </p>
              {expense.note ? <p className="mt-2 rounded-xl bg-mist px-3 py-2 text-sm leading-6 text-ink/70">Note: {expense.note}</p> : null}
            </div>
            <p className="shrink-0 font-semibold text-ink">{currency(Number(expense.amount))}</p>
          </div>
          <div className="mt-2 rounded-xl border border-sage/70 bg-white px-3 py-2">
            <p className="text-xs font-semibold text-ink/70">Transaction details</p>
            <div className="mt-1 grid gap-1 text-xs text-ink/65 sm:grid-cols-2">
              <span>Date: {formatShortDate(expense.spent_on)}</span>
              <span>Category: {expense.category?.name ?? "Category"}</span>
              {expense.merchant ? <span>Merchant: {expense.merchant}</span> : null}
              <span>Added by: {personName(expense.profile?.display_name, expense.profile?.email ?? "Household member")}</span>
            </div>
            {expense.note ? <p className="mt-2 text-sm leading-6 text-ink/75">Note: {expense.note}</p> : null}
          </div>
          <div className="mt-2 rounded-xl bg-mist p-2">
            <div className="mb-2 flex items-center gap-1 text-xs font-semibold text-ink/70">
              <MessageSquare className="h-3.5 w-3.5" />
              Comments
            </div>
            <div className="space-y-1">
              {(commentsByExpense[expense.id] ?? []).slice(-3).map((comment) => (
                <p key={comment.id} className="text-xs text-ink/75">
                  <span className="font-semibold">{personName(comment.profile?.display_name, comment.profile?.email ?? "Household member")}:</span>{" "}
                  {comment.body}
                </p>
              ))}
            </div>
            <form className="mt-2 flex gap-2" onSubmit={(event) => void submitComment(event, expense.id)}>
              <input
                className="w-full rounded-lg border border-sage bg-white px-2 py-1 text-xs"
                placeholder="Add comment"
                value={drafts[expense.id] ?? ""}
                onChange={(event) => setDrafts((value) => ({ ...value, [expense.id]: event.target.value }))}
              />
              <button className="rounded-lg bg-navy px-2 py-1 text-xs font-semibold text-white">Post</button>
            </form>
          </div>
        </div>
      ))}
    </div>
  );
}
