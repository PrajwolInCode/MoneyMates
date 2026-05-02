import { FormEvent, useEffect, useMemo, useState } from "react";
import { Archive, Edit3, Plus, Save, X } from "lucide-react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { FormField } from "../components/FormField";
import { inputClass } from "../components/inputs";
import { PageHeader } from "../components/PageHeader";
import { Toast } from "../components/Toast";
import { WarningBanner } from "../components/WarningBanner";
import { useHousehold } from "../contexts/HouseholdContext";
import {
  budgetItemNeedsAmount,
  monthlyAmountForBudgetItem,
  totalBudgetItemMonthlyIncome,
  totalBudgetItemMonthlyPlannedExpenses,
} from "../lib/budget";
import { BUDGET_START_MONTH } from "../lib/constants";
import { formatMonthLabel } from "../lib/date";
import { currency } from "../lib/format";
import type { BudgetFrequency, BudgetItem, BudgetItemType } from "../types";

type BudgetFormState = {
  itemName: string;
  category: string;
  type: BudgetItemType;
  amount: string;
  frequency: BudgetFrequency;
  quantity: string;
  startDate: string;
  notes: string;
  needsAmount: boolean;
  isActive: boolean;
};

type BudgetGroupKey = "income" | "fixed" | "debt" | "variable" | "saving" | "needs_amount";
type BudgetTemplate = Pick<BudgetFormState, "itemName" | "category" | "type" | "frequency"> & {
  needsAmount?: boolean;
};

const EMPTY_FORM: BudgetFormState = {
  itemName: "",
  category: "Other",
  type: "variable",
  amount: "",
  frequency: "monthly",
  quantity: "1",
  startDate: BUDGET_START_MONTH,
  notes: "",
  needsAmount: false,
  isActive: true,
};

const TYPE_OPTIONS: Array<{ value: BudgetItemType; label: string }> = [
  { value: "income", label: "Income" },
  { value: "fixed", label: "Fixed payment" },
  { value: "variable", label: "Variable spending" },
  { value: "debt", label: "Debt" },
  { value: "saving", label: "Saving" },
  { value: "buffer", label: "Buffer" },
  { value: "info", label: "Info" },
];

const FREQUENCY_OPTIONS: Array<{ value: BudgetFrequency; label: string }> = [
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "one_time", label: "One time" },
  { value: "unknown", label: "Unknown" },
];

const CATEGORY_OPTIONS = [
  "Income",
  "Debt",
  "Food",
  "Housing",
  "Health",
  "Loan",
  "Credit card",
  "Insurance",
  "Groceries",
  "Utilities",
  "Transport",
  "Registration",
  "Pets",
  "Phone",
  "Clothing",
  "Medical",
  "Gym",
  "Travel",
  "Gifts",
  "Dining out",
  "Savings",
  "Buffer",
  "Other",
];

const ITEM_NAME_OPTIONS = [
  "Income",
  "Mortgage / rent",
  "Car loan",
  "Credit card",
  "Insurance",
  "Groceries",
  "Electricity",
  "Water",
  "Gas",
  "Petrol / transport",
  "Rego",
  "Pets",
  "Phone bill",
  "Clothing",
  "Medical",
  "Gym",
  "Travel",
  "Gifts",
  "Dining out",
  "Other custom item",
];

const QUICK_TEMPLATES: BudgetTemplate[] = [
  { itemName: "Income", category: "Income", type: "income", frequency: "monthly" },
  { itemName: "Mortgage / Rent", category: "Housing", type: "fixed", frequency: "monthly" },
  { itemName: "Car loan", category: "Debt", type: "debt", frequency: "monthly" },
  { itemName: "Credit card", category: "Debt", type: "debt", frequency: "unknown", needsAmount: true },
  { itemName: "Insurance", category: "Insurance", type: "fixed", frequency: "monthly" },
  { itemName: "Groceries", category: "Food", type: "variable", frequency: "monthly" },
  { itemName: "Electricity", category: "Utilities", type: "fixed", frequency: "quarterly" },
  { itemName: "Water", category: "Utilities", type: "fixed", frequency: "quarterly" },
  { itemName: "Gas", category: "Utilities", type: "fixed", frequency: "monthly" },
  { itemName: "Petrol / transport", category: "Transport", type: "variable", frequency: "weekly" },
  { itemName: "Rego", category: "Registration", type: "fixed", frequency: "yearly" },
  { itemName: "Pets", category: "Pets", type: "variable", frequency: "monthly" },
  { itemName: "Phone bill", category: "Phone", type: "fixed", frequency: "monthly" },
  { itemName: "Clothing", category: "Clothing", type: "variable", frequency: "monthly" },
  { itemName: "Medical", category: "Medical", type: "variable", frequency: "monthly" },
  { itemName: "Gym", category: "Health", type: "fixed", frequency: "monthly" },
  { itemName: "Travel", category: "Travel", type: "saving", frequency: "monthly" },
  { itemName: "Gifts", category: "Gifts", type: "variable", frequency: "monthly" },
  { itemName: "Dining out", category: "Food", type: "variable", frequency: "monthly" },
  { itemName: "Other custom item", category: "Other", type: "info", frequency: "unknown", needsAmount: true },
];

const GROUPS: Array<{ key: BudgetGroupKey; label: string; description: string }> = [
  { key: "income", label: "Income", description: "Money expected to come into the household." },
  { key: "fixed", label: "Fixed payments", description: "Regular bills and known commitments." },
  { key: "debt", label: "Debt", description: "Loans, credit cards, and repayment plans." },
  { key: "variable", label: "Variable spending", description: "Flexible everyday categories." },
  { key: "saving", label: "Savings/buffer", description: "Planned set-asides and cushions." },
  { key: "needs_amount", label: "Needs amount", description: "Items saved without an amount yet." },
];

function labelForType(type: BudgetItemType) {
  return TYPE_OPTIONS.find((item) => item.value === type)?.label ?? type;
}

function labelForFrequency(frequency: BudgetFrequency) {
  return FREQUENCY_OPTIONS.find((item) => item.value === frequency)?.label ?? frequency;
}

function groupForItem(item: BudgetItem): BudgetGroupKey {
  if (item.is_active && budgetItemNeedsAmount(item)) return "needs_amount";
  if (item.type === "income") return "income";
  if (item.type === "debt") return "debt";
  if (item.type === "variable") return "variable";
  if (item.type === "saving" || item.type === "buffer") return "saving";
  return "fixed";
}

function monthlyLabel(item: BudgetItem) {
  if (!item.is_active) return "Inactive";
  if (budgetItemNeedsAmount(item)) return "Needs amount";
  const monthlyAmount = monthlyAmountForBudgetItem(item);
  if (monthlyAmount === null) return "Not counted";
  return `${currency(monthlyAmount)}/month`;
}

function amountDetail(item: BudgetItem) {
  if (budgetItemNeedsAmount(item)) return "Amount missing";
  const quantityText = Number(item.quantity) === 1 ? "" : ` x ${Number(item.quantity).toLocaleString()}`;
  return `${currency(Number(item.amount))} ${labelForFrequency(item.frequency).toLowerCase()}${quantityText}`;
}

function formFromItem(item: BudgetItem): BudgetFormState {
  return {
    itemName: item.item_name,
    category: item.category,
    type: item.type,
    amount: item.amount === null ? "" : String(Number(item.amount)),
    frequency: item.frequency,
    quantity: String(Number(item.quantity || 1)),
    startDate: item.start_date ?? BUDGET_START_MONTH,
    notes: item.notes ?? "",
    needsAmount: budgetItemNeedsAmount(item),
    isActive: item.is_active,
  };
}

export function BudgetPage() {
  const { budgetItems, monthStart, saveBudgetItem, archiveBudgetItem } = useHousehold();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BudgetFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const activeItems = useMemo(() => budgetItems.filter((item) => !item.archived_at), [budgetItems]);
  const monthlyIncome = useMemo(() => totalBudgetItemMonthlyIncome(activeItems), [activeItems]);
  const plannedExpenses = useMemo(() => totalBudgetItemMonthlyPlannedExpenses(activeItems), [activeItems]);
  const remaining = monthlyIncome - plannedExpenses;
  const needsAmountCount = activeItems.filter((item) => item.is_active && budgetItemNeedsAmount(item)).length;

  const groupedItems = useMemo(() => {
    return activeItems.reduce<Record<BudgetGroupKey, BudgetItem[]>>(
      (groups, item) => {
        groups[groupForItem(item)].push(item);
        return groups;
      },
      { income: [], fixed: [], debt: [], variable: [], saving: [], needs_amount: [] },
    );
  }, [activeItems]);
  const formMonthlyEquivalent = useMemo(() => {
    if (form.needsAmount || form.amount.trim() === "") return "Needs amount";
    const amount = Number(form.amount);
    const quantity = Number(form.quantity);
    if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(quantity) || quantity <= 0) return "Enter amount and quantity";
    const monthlyAmount = monthlyAmountForBudgetItem({
      amount,
      frequency: form.frequency,
      quantity,
      needs_amount: false,
    });
    return monthlyAmount === null ? "Not counted" : `${currency(monthlyAmount)}/month`;
  }, [form.amount, form.frequency, form.needsAmount, form.quantity]);

  const startAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowForm(true);
  };

  const startEdit = (item: BudgetItem) => {
    setEditingId(item.id);
    setForm(formFromItem(item));
    setError(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startFromTemplate = (template: BudgetTemplate) => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      itemName: template.itemName,
      category: template.category,
      type: template.type,
      frequency: template.frequency,
      amount: "",
      needsAmount: Boolean(template.needsAmount),
    });
    setError(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowForm(false);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const parsedAmount = form.needsAmount || form.amount.trim() === "" ? null : Number(form.amount);
    const parsedQuantity = Number(form.quantity);
    const itemName = form.itemName.trim();
    const category = form.category.trim();

    if (!itemName) {
      setError("Enter an item name.");
      return;
    }
    if (!category) {
      setError("Enter a category.");
      return;
    }
    if (parsedAmount !== null && (!Number.isFinite(parsedAmount) || parsedAmount < 0)) {
      setError("Amount must be zero or greater, or left empty.");
      return;
    }
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError("Quantity must be greater than zero.");
      return;
    }

    setSaving(true);
    try {
      await saveBudgetItem(
        {
          item_name: itemName,
          category,
          type: form.type,
          amount: parsedAmount,
          frequency: form.frequency,
          quantity: parsedQuantity,
          start_date: form.startDate || null,
          notes: form.notes.trim() || null,
          needs_amount: form.needsAmount || parsedAmount === null,
          is_active: form.isActive,
        },
        editingId ?? undefined,
      );
      setToast(editingId ? "Budget item updated." : "Budget item added.");
      cancelForm();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save budget item.");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (item: BudgetItem) => {
    const confirmed = window.confirm(`Archive "${item.item_name}"? It will no longer count in this budget.`);
    if (!confirmed) return;
    setArchivingId(item.id);
    setError(null);
    try {
      await archiveBudgetItem(item.id);
      setToast("Budget item archived.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not archive budget item.");
    } finally {
      setArchivingId(null);
    }
  };

  return (
    <div>
      {toast ? <Toast message={toast} /> : null}
      <PageHeader
        eyebrow={formatMonthLabel(monthStart)}
        title="Budget setup"
        description="Build a private household plan by adding income, bills, debt, spending, savings, and custom items."
        action={
          <Button onClick={startAdd}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add budget item
          </Button>
        }
      />

      {error ? (
        <div className="mb-4">
          <WarningBanner tone="strong">{error}</WarningBanner>
        </div>
      ) : null}

      <Card className="mb-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-normal text-ink">Quick templates</h2>
            <p className="text-sm text-ink/60">Start with a common household item, then add the household amount yourself.</p>
          </div>
          <p className="text-sm font-semibold text-moss">No amounts included</p>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_TEMPLATES.map((template) => (
            <button
              key={`${template.itemName}-${template.category}`}
              type="button"
              className="rounded-xl border border-sage bg-mist px-3 py-3 text-left transition hover:border-moss hover:bg-white"
              onClick={() => startFromTemplate(template)}
            >
              <span className="block text-sm font-semibold text-ink">{template.itemName}</span>
              <span className="mt-1 block text-xs text-ink/60">
                {template.category} - {labelForType(template.type)} - {labelForFrequency(template.frequency)}
              </span>
            </button>
          ))}
        </div>
      </Card>

      {showForm ? (
        <Card className="mb-5">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-moss">{editingId ? "Edit item" : "New item"}</p>
                <h2 className="mt-1 text-xl font-bold tracking-normal text-ink">{editingId ? "Update budget item" : "Add budget item"}</h2>
              </div>
              <button type="button" className="rounded-xl p-2 text-ink/50 hover:bg-sage/60" aria-label="Close form" onClick={cancelForm}>
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Item name">
                <input
                  className={inputClass}
                  list="budget-item-name-options"
                  value={form.itemName}
                  onChange={(event) => setForm((current) => ({ ...current, itemName: event.target.value }))}
                  placeholder="Mortgage / rent"
                />
                <datalist id="budget-item-name-options">
                  {ITEM_NAME_OPTIONS.map((itemName) => (
                    <option key={itemName} value={itemName} />
                  ))}
                </datalist>
              </FormField>

              <FormField label="Category">
                <input
                  className={inputClass}
                  list="budget-category-options"
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  placeholder="Housing"
                />
                <datalist id="budget-category-options">
                  {CATEGORY_OPTIONS.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </FormField>

              <FormField label="Type">
                <select
                  className={inputClass}
                  value={form.type}
                  onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as BudgetItemType }))}
                >
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Frequency">
                <select
                  className={inputClass}
                  value={form.frequency}
                  onChange={(event) => setForm((current) => ({ ...current, frequency: event.target.value as BudgetFrequency }))}
                >
                  {FREQUENCY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Amount">
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={form.needsAmount ? "" : form.amount}
                  disabled={form.needsAmount}
                  onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                  placeholder="Leave empty if unknown"
                />
              </FormField>

              <FormField label="Quantity">
                <input
                  className={inputClass}
                  inputMode="decimal"
                  min="0.01"
                  value={form.quantity}
                  onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
                />
              </FormField>

              <FormField label="Start date">
                <input
                  className={inputClass}
                  type="date"
                  value={form.startDate}
                  onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
                />
              </FormField>

              <div className="grid gap-3 rounded-xl border border-sage bg-mist p-4">
                <label className="flex items-start gap-3 text-sm font-semibold text-ink">
                  <input
                    className="mt-1 h-4 w-4 accent-navy"
                    type="checkbox"
                    checked={form.needsAmount}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        needsAmount: event.target.checked,
                        amount: event.target.checked ? "" : current.amount,
                      }))
                    }
                  />
                  <span>
                    Needs amount
                    <span className="block text-xs font-normal leading-5 text-ink/60">Keeps the item visible without counting it in monthly totals.</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 text-sm font-semibold text-ink">
                  <input
                    className="mt-1 h-4 w-4 accent-navy"
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                  />
                  <span>
                    Active
                    <span className="block text-xs font-normal leading-5 text-ink/60">Inactive items stay visible but do not count in totals.</span>
                  </span>
                </label>
              </div>
            </div>

            <FormField label="Notes">
              <textarea
                className={`${inputClass} min-h-24 resize-none`}
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Optional detail"
              />
            </FormField>

            <div className="rounded-xl border border-sage bg-white px-4 py-3">
              <p className="text-sm font-semibold text-ink">Monthly equivalent</p>
              <p className={`mt-1 text-xl font-bold tracking-normal ${formMonthlyEquivalent === "Needs amount" ? "text-coral" : "text-ink"}`}>
                {formMonthlyEquivalent}
              </p>
            </div>

            <div className="rounded-xl bg-sage/45 p-4 text-sm text-ink/70">
              <p className="font-semibold text-ink">Monthly conversion examples</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <span>$185 quarterly = $61.67/month</span>
                <span>$22 weekly x 2 = $190.67/month</span>
                <span>$700 yearly = $58.33/month</span>
                <span>Empty amount = Needs amount</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" loading={saving}>
                <Save className="h-4 w-4" aria-hidden="true" />
                {editingId ? "Save changes" : "Add item"}
              </Button>
              <Button type="button" variant="ghost" onClick={cancelForm}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-sm font-medium text-ink/60">Monthly income</p>
          <p className="mt-2 text-2xl font-bold tracking-normal text-ink">{currency(monthlyIncome)}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-ink/60">Planned expenses</p>
          <p className="mt-2 text-2xl font-bold tracking-normal text-ink">{currency(plannedExpenses)}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-ink/60">Monthly remaining</p>
          <p className={`mt-2 text-2xl font-bold tracking-normal ${remaining < 0 ? "text-coral" : "text-ink"}`}>{currency(remaining)}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-ink/60">Needs amount</p>
          <p className="mt-2 text-2xl font-bold tracking-normal text-ink">{needsAmountCount}</p>
        </Card>
      </div>

      <section className="mt-5">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-normal text-ink">Budget items</h2>
            <p className="text-sm text-ink/60">Manual household items with monthly equivalents, notes, and amount status.</p>
          </div>
          <p className="text-sm font-semibold text-moss">{activeItems.length} active item{activeItems.length === 1 ? "" : "s"}</p>
        </div>
        <div className="space-y-4">
        {GROUPS.map((group) => {
          const items = groupedItems[group.key];
          return (
            <Card key={group.key}>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold tracking-normal text-ink">{group.label}</h2>
                  <p className="text-sm text-ink/60">{group.description}</p>
                </div>
                <p className="text-sm font-semibold text-moss">{items.length} item{items.length === 1 ? "" : "s"}</p>
              </div>

              {items.length ? (
                <div className="mt-4 divide-y divide-sage/70">
                  {items.map((item) => (
                    <div key={item.id} className={`py-4 ${item.is_active ? "" : "opacity-65"}`}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-ink">{item.item_name}</p>
                            <span className="rounded-full bg-sage px-2 py-0.5 text-xs font-semibold text-ink/70">{labelForType(item.type)}</span>
                            {!item.is_active ? <span className="rounded-full bg-coral/15 px-2 py-0.5 text-xs font-semibold text-coral">Inactive</span> : null}
                          </div>
                          <p className="mt-1 text-sm text-ink/60">
                            {item.category} - {amountDetail(item)}
                          </p>
                          {item.notes ? <p className="mt-2 rounded-xl bg-mist px-3 py-2 text-sm leading-6 text-ink/70">{item.notes}</p> : null}
                        </div>
                        <div className="flex shrink-0 items-center justify-between gap-2 sm:min-w-52 sm:justify-end">
                          <p className={`text-sm font-bold ${budgetItemNeedsAmount(item) ? "text-coral" : "text-ink"}`}>{monthlyLabel(item)}</p>
                          <button
                            type="button"
                            className="rounded-xl border border-sage bg-white p-2 text-ink/70 hover:border-moss"
                            aria-label={`Edit ${item.item_name}`}
                            onClick={() => startEdit(item)}
                          >
                            <Edit3 className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="rounded-xl border border-coral/30 bg-white p-2 text-coral hover:bg-coral/10 disabled:opacity-50"
                            aria-label={`Archive ${item.item_name}`}
                            disabled={archivingId === item.id}
                            onClick={() => void handleArchive(item)}
                          >
                            <Archive className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-sage bg-mist px-4 py-5 text-sm text-ink/60">
                  No items in this group yet.
                </div>
              )}
            </Card>
          );
        })}
        </div>
      </section>
    </div>
  );
}
