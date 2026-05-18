import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Edit3, MessageSquare, ReceiptText, Save, Send, Tag, Trash2, User2, X } from "lucide-react";
import type { Expense } from "../types";
import { formatShortDate, toISODate } from "../lib/date";
import { currency, personName } from "../lib/format";
import { getCard } from "../lib/cards";
import { EmptyState } from "./EmptyState";
import { CardChip } from "./CardChip";
import { CardPicker } from "./CardPicker";
import { FormField } from "./FormField";
import { inputClass } from "./inputs";
import { WarningBanner } from "./WarningBanner";
import { useAuth } from "../contexts/AuthContext";
import { useHousehold } from "../contexts/HouseholdContext";

type TransactionsListProps = {
  expenses: Expense[];
  limit?: number;
  emptyTitle?: string;
  emptyMessage?: string;
};

type EditFormState = {
  amount: string;
  categoryId: string;
  spentOn: string;
  merchant: string;
  note: string;
  cardId: string | null;
};

function formFromExpense(expense: Expense): EditFormState {
  return {
    amount: String(Number(expense.amount)),
    categoryId: expense.category_id,
    spentOn: toISODate(new Date(expense.spent_on)),
    merchant: expense.merchant ?? "",
    note: expense.note ?? "",
    cardId: expense.card_id ?? null,
  };
}

export function TransactionsList({ expenses, limit, emptyTitle = "No expenses yet", emptyMessage = "Your first saved expense will appear here with who added it." }: TransactionsListProps) {
  const { user } = useAuth();
  const { categories, expenseComments, addExpenseComment, deleteExpense, updateExpense } = useHousehold();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const rows = limit ? expenses.slice(0, limit) : expenses;
  const selectedExpense = rows.find((expense) => expense.id === selectedId) ?? null;

  const commentsByExpense = useMemo(() => {
    return expenseComments.reduce<Record<string, typeof expenseComments>>((acc, item) => {
      if (!acc[item.expense_id]) acc[item.expense_id] = [];
      acc[item.expense_id].push(item);
      return acc;
    }, {});
  }, [expenseComments]);

  useEffect(() => {
    if (!selectedExpense) {
      setEditingId(null);
      setEditForm(null);
      setEditError(null);
    }
  }, [selectedExpense]);

  useEffect(() => {
    if (!selectedExpense) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
    };
  }, [selectedExpense]);

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

  const handleDelete = async (expense: Expense) => {
    const confirmed = window.confirm(`Delete this ${currency(Number(expense.amount))} transaction?`);
    if (!confirmed) return;
    setDeletingId(expense.id);
    try {
      await deleteExpense(expense.id);
      setSelectedId(null);
    } catch (caught) {
      window.alert(caught instanceof Error ? caught.message : "Could not delete transaction.");
    } finally {
      setDeletingId(null);
    }
  };

  const beginEdit = (expense: Expense) => {
    setEditError(null);
    setEditingId(expense.id);
    setEditForm(formFromExpense(expense));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
    setEditError(null);
  };

  const submitEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedExpense || !editForm) return;
    setEditError(null);
    const parsedAmount = Number(editForm.amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setEditError("Enter an amount greater than zero.");
      return;
    }
    if (!editForm.categoryId) {
      setEditError("Choose a category.");
      return;
    }
    if (!editForm.spentOn) {
      setEditError("Choose a date.");
      return;
    }
    setSavingEdit(true);
    try {
      await updateExpense(selectedExpense.id, {
        amount: parsedAmount,
        category_id: editForm.categoryId,
        spent_on: editForm.spentOn,
        merchant: editForm.merchant.trim(),
        note: editForm.note.trim(),
        card_id: editForm.cardId,
      });
      cancelEdit();
    } catch (caught) {
      setEditError(caught instanceof Error ? caught.message : "Could not save changes.");
    } finally {
      setSavingEdit(false);
    }
  };

  const displayTitle = (expense: Expense) => {
    const merchant = expense.merchant?.trim();
    if (merchant) return merchant;
    const note = expense.note?.trim();
    if (expense.category?.name === "Other" && note) return note;
    return expense.category?.name ?? "Category";
  };

  return (
    <div className="divide-y divide-sage/70">
      {rows.map((expense) => {
        const card = getCard(expense.card_id);
        const categoryName = expense.category?.name ?? "Category";
        const showCategoryBadge = Boolean(expense.merchant?.trim()) || (expense.category?.name === "Other" && Boolean(expense.note?.trim()));
        return (
          <button key={expense.id} className="block w-full py-3 text-left" onClick={() => { setSelectedId(expense.id); setCommentsOpen(false); }}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">
                  {displayTitle(expense)} {expense.note ? <MessageSquare className="ml-1 inline h-3.5 w-3.5 text-moss" aria-label="Has note" /> : null}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink/60">
                  {showCategoryBadge ? (
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      style={{ backgroundColor: `${expense.category?.color ?? "#94a3b8"}1A`, color: expense.category?.color ?? "#475569" }}
                    >
                      {categoryName}
                    </span>
                  ) : null}
                  <span>{formatShortDate(expense.spent_on)}</span>
                  <span>{personName(expense.profile?.display_name, expense.profile?.email ?? "Household member")}</span>
                  {card ? <CardChip card={card} size="xs" /> : null}
                </div>
              </div>
              <p className="shrink-0 font-semibold text-ink">{currency(Number(expense.amount))}</p>
            </div>
          </button>
        );
      })}
      {selectedExpense ? createPortal(
        <div
          className="mm-dialog-overlay fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="transaction-dialog-title"
          onClick={() => setSelectedId(null)}
        >
          <div
            className="mm-dialog-panel relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-soft"
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="h-1.5 w-full flex-shrink-0"
              style={{ backgroundColor: selectedExpense.category?.color ?? "#0f3d3e" }}
              aria-hidden="true"
            />
            <header className="flex items-start justify-between gap-3 px-5 pt-5 sm:px-6">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-moss">
                  {editingId === selectedExpense.id ? "Edit transaction" : "Transaction"}
                </p>
                <h2
                  id="transaction-dialog-title"
                  className="mt-1 truncate text-2xl font-bold tracking-tightish text-ink"
                >
                  {displayTitle(selectedExpense)}
                </h2>
                <p className="mt-1 text-3xl font-bold tracking-tight text-ink">{currency(Number(selectedExpense.amount))}</p>
              </div>
              <button
                className="flex-shrink-0 rounded-xl border border-sage p-2 text-ink/60 transition hover:bg-mist hover:text-ink"
                aria-label="Close transaction detail"
                onClick={() => setSelectedId(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 pb-5 pt-4 sm:px-6">
              {editingId === selectedExpense.id && editForm ? (
                <form className="space-y-3" onSubmit={submitEdit}>
                  <FormField label="Amount">
                    <input
                      className={inputClass}
                      inputMode="decimal"
                      value={editForm.amount}
                      onChange={(event) => setEditForm((current) => current ? { ...current, amount: event.target.value } : current)}
                    />
                  </FormField>
                  <FormField label="Category">
                    <select
                      className={inputClass}
                      value={editForm.categoryId}
                      onChange={(event) => setEditForm((current) => current ? { ...current, categoryId: event.target.value } : current)}
                    >
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Date">
                    <input
                      className={inputClass}
                      type="date"
                      value={editForm.spentOn}
                      onChange={(event) => setEditForm((current) => current ? { ...current, spentOn: event.target.value } : current)}
                    />
                  </FormField>
                  <FormField label="Merchant or place">
                    <input
                      className={inputClass}
                      value={editForm.merchant}
                      onChange={(event) => setEditForm((current) => current ? { ...current, merchant: event.target.value } : current)}
                      placeholder="Woolworths"
                    />
                  </FormField>
                  <CardPicker
                    value={editForm.cardId}
                    onChange={(nextCardId) => setEditForm((current) => current ? { ...current, cardId: nextCardId } : current)}
                    helperText="Update the card if you paid with a different one."
                  />
                  <FormField label="Note">
                    <textarea
                      className={`${inputClass} min-h-20 resize-none`}
                      value={editForm.note}
                      onChange={(event) => setEditForm((current) => current ? { ...current, note: event.target.value } : current)}
                    />
                  </FormField>
                  {editError ? <WarningBanner tone="strong">{editError}</WarningBanner> : null}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={savingEdit}
                      className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-navy px-3 py-2 text-sm font-semibold text-white shadow-soft hover:bg-ink disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" aria-hidden="true" />
                      {savingEdit ? "Saving..." : "Save changes"}
                    </button>
                    <button
                      type="button"
                      className="inline-flex min-h-10 items-center justify-center rounded-xl border border-sage px-3 py-2 text-sm font-semibold text-ink hover:bg-mist"
                      onClick={cancelEdit}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="flex items-start gap-2.5 rounded-xl bg-mist px-3 py-2.5">
                      <Tag className="mt-0.5 h-4 w-4 flex-shrink-0 text-moss" aria-hidden="true" />
                      <div className="min-w-0">
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink/50">Category</dt>
                        <dd className="truncate text-sm font-semibold text-ink">{selectedExpense.category?.name ?? "Category"}</dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 rounded-xl bg-mist px-3 py-2.5">
                      <CalendarDays className="mt-0.5 h-4 w-4 flex-shrink-0 text-moss" aria-hidden="true" />
                      <div className="min-w-0">
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink/50">Date</dt>
                        <dd className="text-sm font-semibold text-ink">{formatShortDate(selectedExpense.spent_on)}</dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 rounded-xl bg-mist px-3 py-2.5">
                      <User2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-moss" aria-hidden="true" />
                      <div className="min-w-0">
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink/50">Added by</dt>
                        <dd className="truncate text-sm font-semibold text-ink">
                          {personName(selectedExpense.profile?.display_name, selectedExpense.profile?.email ?? "Household member")}
                        </dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 rounded-xl bg-mist px-3 py-2.5">
                      <div className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center text-moss">
                        <span className="block h-2 w-2 rounded-full bg-moss" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink/50">Paid with</dt>
                        <dd className="mt-0.5 text-sm font-semibold text-ink">
                          {(() => {
                            const card = getCard(selectedExpense.card_id);
                            return card ? <CardChip card={card} size="sm" showName /> : <span className="text-ink/55">Not recorded</span>;
                          })()}
                        </dd>
                      </div>
                    </div>
                  </dl>
                  {selectedExpense.merchant?.trim() ? (
                    <p className="mt-3 text-xs text-ink/55">
                      <span className="font-semibold text-ink/70">Merchant:</span> {selectedExpense.merchant}
                    </p>
                  ) : null}
                  {selectedExpense.note?.trim() ? (
                    <div className="mt-3 rounded-xl border border-sage/70 bg-sage/30 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-moss">Note</p>
                      <p className="mt-1 whitespace-pre-line text-sm text-ink/75">{selectedExpense.note}</p>
                    </div>
                  ) : null}
                  {selectedExpense.user_id === user?.id ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-navy px-3 py-2 text-sm font-semibold text-white shadow-soft hover:bg-ink sm:flex-initial"
                        onClick={() => beginEdit(selectedExpense)}
                      >
                        <Edit3 className="h-4 w-4" aria-hidden="true" />
                        Edit
                      </button>
                      <button
                        className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-coral/30 px-3 py-2 text-sm font-semibold text-coral hover:bg-coral/10 disabled:opacity-50 sm:flex-initial"
                        type="button"
                        disabled={deletingId === selectedExpense.id}
                        onClick={() => void handleDelete(selectedExpense)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        {deletingId === selectedExpense.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-4 rounded-xl bg-mist px-3 py-2 text-xs text-ink/55">
                      Only the member who added this transaction can edit or delete it.
                    </p>
                  )}
                  <div className="mt-5 rounded-2xl border border-sage/60 bg-sage/30 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-ink">
                        Comments
                        {(commentsByExpense[selectedExpense.id] ?? []).length > 0 ? (
                          <span className="ml-1.5 text-xs font-medium text-ink/55">
                            ({(commentsByExpense[selectedExpense.id] ?? []).length})
                          </span>
                        ) : null}
                      </p>
                      {(commentsByExpense[selectedExpense.id] ?? []).length > 1 ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-moss hover:underline"
                          onClick={() => setCommentsOpen((value) => !value)}
                        >
                          {commentsOpen ? "Show latest" : "View all"}
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {(commentsByExpense[selectedExpense.id] ?? []).length === 0 ? (
                        <p className="text-xs text-ink/55">No comments yet — start the thread.</p>
                      ) : (
                        (commentsOpen ? commentsByExpense[selectedExpense.id] ?? [] : (commentsByExpense[selectedExpense.id] ?? []).slice(-1)).map((comment) => (
                          <div key={comment.id} className="rounded-xl bg-white px-3 py-2 text-sm">
                            <p className="text-[11px] font-semibold text-moss">
                              {personName(comment.profile?.display_name, comment.profile?.email ?? "Household member")}
                            </p>
                            <p className="mt-0.5 text-sm text-ink/75">{comment.body}</p>
                          </div>
                        ))
                      )}
                    </div>
                    <form className="mt-3 flex gap-2" onSubmit={(event) => void submitComment(event, selectedExpense.id)}>
                      <input
                        className="min-w-0 flex-1 rounded-lg border border-sage bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-moss/40"
                        placeholder="Add a comment"
                        value={drafts[selectedExpense.id] ?? ""}
                        onChange={(event) => setDrafts((value) => ({ ...value, [selectedExpense.id]: event.target.value }))}
                      />
                      <button
                        type="submit"
                        disabled={!drafts[selectedExpense.id]?.trim()}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-white hover:bg-ink disabled:opacity-40"
                      >
                        <Send className="h-3.5 w-3.5" aria-hidden="true" />
                        Post
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
