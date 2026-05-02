import { FormEvent, useMemo, useState } from "react";
import { MessageSquare, ReceiptText, X } from "lucide-react";
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const rows = limit ? expenses.slice(0, limit) : expenses;
  const selectedExpense = rows.find((expense) => expense.id === selectedId) ?? null;

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
        <button key={expense.id} className="block w-full py-3 text-left" onClick={() => { setSelectedId(expense.id); setCommentsOpen(false); }}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">
                {expense.category?.name ?? "Category"} {expense.note ? <MessageSquare className="ml-1 inline h-3.5 w-3.5 text-moss" aria-label="Has note" /> : null}
              </p>
              <p className="truncate text-sm text-ink/60">
                {formatShortDate(expense.spent_on)} -{" "}
                {personName(expense.profile?.display_name, expense.profile?.email ?? "Household member")}
              </p>
            </div>
            <p className="shrink-0 font-semibold text-ink">{currency(Number(expense.amount))}</p>
          </div>
        </button>
      ))}
      {selectedExpense ? (
        <div className="fixed inset-0 z-50 bg-ink/30" onClick={() => setSelectedId(null)}>
          <aside className="fixed inset-x-0 bottom-0 max-h-[86vh] overflow-auto rounded-t-3xl bg-white p-4 shadow-soft md:inset-y-0 md:left-auto md:right-0 md:w-[28rem] md:rounded-l-3xl md:rounded-tr-none" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-moss">Transaction detail</p>
                <h2 className="mt-1 text-2xl font-bold tracking-normal text-ink">{currency(Number(selectedExpense.amount))}</h2>
              </div>
              <button className="rounded-xl border border-sage p-2 text-ink/70" aria-label="Close transaction detail" onClick={() => setSelectedId(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-ink/70">
              <p><span className="font-semibold text-ink">Merchant:</span> {selectedExpense.merchant || "Not added"}</p>
              <p><span className="font-semibold text-ink">Category:</span> {selectedExpense.category?.name ?? "Category"}</p>
              <p><span className="font-semibold text-ink">Member:</span> {personName(selectedExpense.profile?.display_name, selectedExpense.profile?.email ?? "Household member")}</p>
              <p><span className="font-semibold text-ink">Date:</span> {formatShortDate(selectedExpense.spent_on)}</p>
              <p className="rounded-xl bg-mist p-3"><span className="font-semibold text-ink">Note:</span> {selectedExpense.note || "No note added."}</p>
            </div>
            <div className="mt-4 rounded-2xl bg-sage/45 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink">Comments</p>
                {(commentsByExpense[selectedExpense.id] ?? []).length > 1 ? (
                  <button className="text-xs font-semibold text-moss" onClick={() => setCommentsOpen((value) => !value)}>
                    {commentsOpen ? "Hide comments" : "View comments"}
                  </button>
                ) : null}
              </div>
              {(commentsOpen ? commentsByExpense[selectedExpense.id] ?? [] : (commentsByExpense[selectedExpense.id] ?? []).slice(-1)).map((comment) => (
                <p key={comment.id} className="mt-2 text-sm text-ink/75">
                  <span className="font-semibold">{personName(comment.profile?.display_name, comment.profile?.email ?? "Household member")}:</span> {comment.body}
                </p>
              ))}
              <form className="mt-3 flex gap-2" onSubmit={(event) => void submitComment(event, selectedExpense.id)}>
                <input className="w-full rounded-lg border border-sage bg-white px-3 py-2 text-sm" placeholder="Add comment" value={drafts[selectedExpense.id] ?? ""} onChange={(event) => setDrafts((value) => ({ ...value, [selectedExpense.id]: event.target.value }))} />
                <button className="rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-white">Post</button>
              </form>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
