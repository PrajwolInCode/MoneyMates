import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, Save, X } from "lucide-react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { FormField } from "../components/FormField";
import { inputClass } from "../components/inputs";
import { MonthSelector } from "../components/MonthSelector";
import { PageHeader } from "../components/PageHeader";
import { RefreshDataButton } from "../components/RefreshDataButton";
import { Toast } from "../components/Toast";
import { TransactionsList } from "../components/TransactionsList";
import { WarningBanner } from "../components/WarningBanner";
import { useHousehold } from "../contexts/HouseholdContext";
import { toISODate } from "../lib/date";
import { currency, personName } from "../lib/format";

export function TransactionsPage() {
  const { categories, expenses, members, addExpense } = useHousehold();

  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [spentOn, setSpentOn] = useState(toISODate(new Date()));
  const [merchant, setMerchant] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [filterMemberId, setFilterMemberId] = useState<string | null>(null);

  useEffect(() => {
    if (!categoryId && categories[0]) setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  const memberSpending = useMemo(
    () =>
      members.map((m) => {
        const memberExpenses = expenses.filter((e) => e.user_id === m.user_id);
        return {
          member: m,
          name: personName(m.profile?.display_name, m.profile?.email ?? "Member"),
          spent: memberExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
          count: memberExpenses.length,
        };
      }),
    [members, expenses],
  );

  const filteredExpenses = useMemo(
    () => (filterMemberId ? expenses.filter((e) => e.user_id === filterMemberId) : expenses),
    [expenses, filterMemberId],
  );

  const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaveError(null);
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setSaveError("Enter an amount greater than zero.");
      return;
    }
    if (!categoryId) {
      setSaveError("Choose a category.");
      return;
    }
    setSaving(true);
    try {
      const categoryName = categories.find((c) => c.id === categoryId)?.name ?? "Expense";
      await addExpense({
        amount: parsedAmount,
        category_id: categoryId,
        spent_on: spentOn,
        merchant: merchant.trim(),
        note: note.trim(),
      });
      setAmount("");
      setMerchant("");
      setNote("");
      setShowForm(false);
      setToast(`Added: ${categoryName} – ${currency(parsedAmount)}`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save expense.");
    } finally {
      setSaving(false);
    }
  };

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; total: number }>();
    for (const e of expenses) {
      const name = e.category?.name ?? "Other";
      const existing = map.get(name) ?? { name, total: 0 };
      map.set(name, { ...existing, total: existing.total + Number(e.amount) });
    }
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [expenses]);

  return (
    <div className="pb-24 md:pb-0">
      {toast ? <Toast message={toast} /> : null}

      <PageHeader
        eyebrow="This month"
        title="Transactions"
        description="All household spending in one place. Filter by member or add a new expense."
        action={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <MonthSelector />
            <RefreshDataButton className="w-full sm:w-auto" />
            <Button className="w-full sm:w-auto" onClick={() => setShowForm((v) => !v)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add expense
            </Button>
          </div>
        }
      />

      {/* Spending summary */}
      <div className={`mb-5 grid gap-3 ${members.length > 1 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Total spent</p>
          <p className="mt-1 text-2xl font-bold text-ink">{currency(totalSpent)}</p>
          <p className="mt-1 text-xs text-ink/50">{expenses.length} transaction{expenses.length === 1 ? "" : "s"}</p>
        </Card>
        {memberSpending.map(({ member, name, spent, count }) => (
          <Card key={member.user_id} className="p-4">
            <p className="truncate text-xs font-semibold uppercase tracking-wide text-ink/50">{name}</p>
            <p className="mt-1 text-2xl font-bold text-ink">{currency(spent)}</p>
            <p className="mt-1 text-xs text-ink/50">{count} transaction{count === 1 ? "" : "s"}</p>
          </Card>
        ))}
      </div>

      {/* Top categories this month */}
      {categoryBreakdown.length > 0 ? (
        <Card className="mb-5">
          <p className="mb-3 text-sm font-semibold text-moss">Top categories this month</p>
          <div className="space-y-2">
            {categoryBreakdown.map((row) => {
              const pct = totalSpent > 0 ? (row.total / totalSpent) * 100 : 0;
              return (
                <div key={row.name}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-ink">{row.name}</span>
                    <span className="font-semibold text-ink">{currency(row.total)}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-sage/50">
                    <div className="h-full rounded-full bg-navy" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {/* Add expense form */}
      {showForm ? (
        <Card className="mb-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-moss">New expense</p>
              <h2 className="mt-1 text-xl font-bold tracking-normal text-ink">Record a transaction</h2>
            </div>
            <button
              type="button"
              className="rounded-xl border border-sage p-2 text-ink/60 hover:bg-sage/60"
              aria-label="Close form"
              onClick={() => setShowForm(false)}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Amount">
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="42.50"
                  autoFocus
                />
              </FormField>
              <FormField label="Category">
                <select className={inputClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Date">
                <input className={inputClass} type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} />
              </FormField>
              <FormField label="Merchant or place">
                <input className={inputClass} value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Woolworths" />
              </FormField>
            </div>
            <FormField label="Note">
              <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" />
            </FormField>
            {saveError ? <WarningBanner tone="strong">{saveError}</WarningBanner> : null}
            <div className="flex gap-2">
              <Button type="submit" loading={saving}>
                <Save className="h-4 w-4" aria-hidden="true" />
                Save expense
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {/* Member filter tabs */}
      {members.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${!filterMemberId ? "bg-navy text-white" : "bg-mist text-ink hover:bg-sage"}`}
            onClick={() => setFilterMemberId(null)}
          >
            Everyone ({expenses.length})
          </button>
          {memberSpending.map(({ member, name, count }) => (
            <button
              key={member.user_id}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${filterMemberId === member.user_id ? "bg-navy text-white" : "bg-mist text-ink hover:bg-sage"}`}
              onClick={() => setFilterMemberId(filterMemberId === member.user_id ? null : member.user_id)}
            >
              {name} ({count})
            </button>
          ))}
        </div>
      ) : null}

      {/* Transactions list */}
      <Card>
        <TransactionsList
          expenses={filteredExpenses}
          emptyTitle="No transactions yet"
          emptyMessage="Add your first expense above to start tracking."
        />
      </Card>

      {/* Mobile FAB */}
      <div className="fixed bottom-20 left-4 right-4 z-20 md:hidden">
        <Button className="w-full shadow-soft" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add expense
        </Button>
      </div>
    </div>
  );
}
