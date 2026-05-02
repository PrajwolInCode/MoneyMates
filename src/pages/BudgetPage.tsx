import { FormEvent, useEffect, useMemo, useState } from "react";
import { Archive, Edit3, Plus, Save, X } from "lucide-react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { FormField } from "../components/FormField";
import { inputClass } from "../components/inputs";
import { MonthSelector } from "../components/MonthSelector";
import { PageHeader } from "../components/PageHeader";
import { RefreshDataButton } from "../components/RefreshDataButton";
import { Toast } from "../components/Toast";
import { WarningBanner } from "../components/WarningBanner";
import { useAuth } from "../contexts/AuthContext";
import { useHousehold } from "../contexts/HouseholdContext";
import {
  budgetItemNeedsAmount,
  monthlyAmountForBudgetItem,
  totalBudget,
  totalBudgetItemMonthlyIncome,
  totalSpent,
} from "../lib/budget";
import { formatMonthLabel } from "../lib/date";
import { currency, personName } from "../lib/format";
import type { BudgetFrequency, BudgetItem, BudgetItemScope, BudgetItemType } from "../types";

type BudgetFormState = {
  itemName: string;
  category: string;
  type: BudgetItemType;
  amount: string;
  frequency: BudgetFrequency;
  quantity: string;
  ownerUserId: string;
  payerUserId: string;
  scope: BudgetItemScope;
  startDate: string;
  notes: string;
  needsAmount: boolean;
  isActive: boolean;
};

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
  ownerUserId: "",
  payerUserId: "",
  scope: "personal",
  startDate: "",
  notes: "",
  needsAmount: false,
  isActive: true,
};

const TYPE_OPTIONS: Array<{ value: BudgetItemType; label: string; help: string }> = [
  { value: "income", label: "Income", help: "Money coming in" },
  { value: "fixed", label: "Fixed bill", help: "Regular bill" },
  { value: "debt", label: "Debt", help: "Loan or card" },
  { value: "variable", label: "Flexible spending", help: "Changes month to month" },
  { value: "saving", label: "Saving", help: "Set aside" },
  { value: "buffer", label: "Buffer", help: "Cushion" },
  { value: "info", label: "Info only", help: "Not counted" },
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
  "Housing",
  "Debt",
  "Food",
  "Utilities",
  "Transport",
  "Insurance",
  "Phone",
  "Health",
  "Pets",
  "Travel",
  "Gifts",
  "Clothes",
  "Dining out",
  "Savings",
  "Buffer",
  "Other",
];

const ITEM_NAME_OPTIONS = [
  "Salary",
  "Mortgage / rent",
  "Car loan",
  "Credit card",
  "Mobile bill",
  "Gym",
  "Rego",
  "Insurance",
  "Groceries",
  "Utilities",
  "Petrol",
  "Dining out",
  "Gifts",
  "Clothes",
  "Custom item",
];

const COMMON_TEMPLATES: BudgetTemplate[] = [
  { itemName: "Salary", category: "Income", type: "income", frequency: "monthly" },
  { itemName: "Mortgage / rent", category: "Housing", type: "fixed", frequency: "monthly" },
  { itemName: "Car loan", category: "Debt", type: "debt", frequency: "monthly" },
  { itemName: "Credit card", category: "Debt", type: "debt", frequency: "unknown", needsAmount: true },
  { itemName: "Mobile bill", category: "Phone", type: "fixed", frequency: "monthly" },
  { itemName: "Gym", category: "Health", type: "fixed", frequency: "monthly" },
  { itemName: "Rego", category: "Transport", type: "fixed", frequency: "yearly" },
  { itemName: "Insurance", category: "Insurance", type: "fixed", frequency: "monthly" },
  { itemName: "Groceries", category: "Food", type: "variable", frequency: "monthly" },
  { itemName: "Utilities", category: "Utilities", type: "fixed", frequency: "monthly" },
  { itemName: "Petrol", category: "Transport", type: "variable", frequency: "weekly" },
  { itemName: "Dining out", category: "Dining out", type: "variable", frequency: "monthly" },
  { itemName: "Gifts", category: "Gifts", type: "variable", frequency: "monthly" },
  { itemName: "Clothes", category: "Clothes", type: "variable", frequency: "monthly" },
  { itemName: "Custom item", category: "Other", type: "variable", frequency: "monthly" },
];

function labelForFrequency(frequency: BudgetFrequency) {
  return FREQUENCY_OPTIONS.find((item) => item.value === frequency)?.label ?? frequency;
}

function monthlyValue(item: BudgetItem) {
  if (!item.is_active || budgetItemNeedsAmount(item) || item.type === "info") return 0;
  return monthlyAmountForBudgetItem(item) ?? 0;
}

function monthlyLabel(item: BudgetItem) {
  if (!item.is_active) return "Inactive";
  if (budgetItemNeedsAmount(item)) return "Needs amount";
  const monthlyAmount = monthlyAmountForBudgetItem(item);
  if (monthlyAmount === null || item.type === "info") return "Not counted";
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
    ownerUserId: item.owner_user_id || item.created_by,
    payerUserId: item.payer_user_id ?? "",
    scope: item.scope,
    startDate: item.start_date ?? "",
    notes: item.notes ?? "",
    needsAmount: budgetItemNeedsAmount(item),
    isActive: item.is_active,
  };
}

function templateForm(template: BudgetTemplate, monthStart: string): BudgetFormState {
  return {
    ...EMPTY_FORM,
    itemName: template.itemName,
    category: template.category,
    type: template.type,
    frequency: template.frequency,
    amount: "",
    startDate: monthStart,
    scope: ["Food", "Utilities", "Dining out", "Gifts", "Clothes"].includes(template.category) || template.itemName === "Mortgage / rent" ? "shared" : "personal",
    needsAmount: Boolean(template.needsAmount),
  };
}

export function BudgetPage() {
  const { user } = useAuth();
  const { members, budgetItems, budgetMonth, budgetLimits, expenses, monthStart, dataWarnings, saveBudgetItem, archiveBudgetItem } = useHousehold();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BudgetFormState>({ ...EMPTY_FORM, startDate: monthStart });
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
  const defaultMemberId = user?.id ?? members[0]?.user_id ?? "";
  const memberOptions = useMemo(
    () =>
      members.map((member, index) => ({
        id: member.user_id,
        label: personName(member.profile?.display_name, member.profile?.email ?? `Member ${index + 1}`),
      })),
    [members],
  );
  const memberNames = useMemo(
    () =>
      new Map(
        memberOptions.map((member) => [member.id, member.label]),
      ),
    [memberOptions],
  );
  const hasBudgetItems = activeItems.length > 0;
  const itemMonthlyIncome = useMemo(() => totalBudgetItemMonthlyIncome(activeItems), [activeItems]);
  const legacyIncome = Number(budgetMonth?.total_income ?? 0);
  const legacyPlannedExpenses = totalBudget(budgetMonth, budgetLimits);
  const actualSpent = totalSpent(expenses);
  const monthlyIncome = itemMonthlyIncome > 0 ? itemMonthlyIncome : legacyIncome;
  const showingLegacyBudget = !activeItems.length && (legacyIncome > 0 || legacyPlannedExpenses > 0);
  const budgetItemsLoadWarning = dataWarnings.find((warning) =>
    warning.includes("Budget items could not load. Your expenses and household data are still safe."),
  );

  const incomeItems = useMemo(() => activeItems.filter((item) => item.type === "income" && !budgetItemNeedsAmount(item)), [activeItems]);
  const personalBillItems = useMemo(
    () =>
      activeItems.filter(
        (item) =>
          item.scope === "personal" &&
          !budgetItemNeedsAmount(item) &&
          item.type !== "income" &&
          item.type !== "debt" &&
          item.type !== "saving" &&
          item.type !== "buffer",
      ),
    [activeItems],
  );
  const sharedExpenseItems = useMemo(
    () =>
      activeItems.filter(
        (item) =>
          item.scope === "shared" &&
          !budgetItemNeedsAmount(item) &&
          item.type !== "income" &&
          item.type !== "debt" &&
          item.type !== "saving" &&
          item.type !== "buffer",
      ),
    [activeItems],
  );
  const debtItems = useMemo(() => activeItems.filter((item) => item.type === "debt" && !budgetItemNeedsAmount(item)), [activeItems]);
  const savingsItems = useMemo(
    () => activeItems.filter((item) => (item.type === "saving" || item.type === "buffer") && !budgetItemNeedsAmount(item)),
    [activeItems],
  );
  const needsAmountItems = useMemo(() => activeItems.filter((item) => item.is_active && budgetItemNeedsAmount(item)), [activeItems]);

  const personalBillsTotal = personalBillItems.reduce((sum, item) => sum + monthlyValue(item), 0);
  const sharedExpensesTotal = sharedExpenseItems.reduce((sum, item) => sum + monthlyValue(item), 0);
  const debtRepaymentsTotal = debtItems.reduce((sum, item) => sum + monthlyValue(item), 0);
  const savingsGoalTotal = savingsItems.reduce((sum, item) => sum + monthlyValue(item), 0);
  const expectedRemaining = monthlyIncome - personalBillsTotal - sharedExpensesTotal - debtRepaymentsTotal - savingsGoalTotal;

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

  const openForm = (template?: BudgetTemplate) => {
    setEditingId(null);
    const nextForm = template ? templateForm(template, monthStart) : { ...EMPTY_FORM, startDate: monthStart };
    setForm({
      ...nextForm,
      ownerUserId: defaultMemberId,
      payerUserId: defaultMemberId,
    });
    setError(null);
    setShowForm(true);
  };

  const startEdit = (item: BudgetItem) => {
    setEditingId(item.id);
    setForm(formFromItem(item));
    setError(null);
    setShowForm(true);
  };

  const applyTemplate = (template: BudgetTemplate) => {
    setForm((current) => ({
      ...current,
      itemName: template.itemName,
      category: template.category,
      type: template.type,
      frequency: template.frequency,
      amount: "",
      scope: ["Food", "Utilities", "Dining out", "Gifts", "Clothes"].includes(template.category) || template.itemName === "Mortgage / rent" ? "shared" : current.scope,
      needsAmount: Boolean(template.needsAmount),
    }));
  };

  const cancelForm = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, startDate: monthStart, ownerUserId: defaultMemberId, payerUserId: defaultMemberId });
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
    if (!form.ownerUserId) {
      setError("Choose who this item belongs to.");
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
          owner_user_id: form.ownerUserId,
          payer_user_id: form.payerUserId || null,
          scope: form.scope,
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
          item_scope: form.scope,
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

  const renderBudgetItemCard = (item: BudgetItem) => (
    <div key={item.id} className={`rounded-xl border border-sage bg-mist px-3 py-3 ${item.is_active ? "" : "opacity-65"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-ink">{item.item_name}</p>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-ink/70">
              {item.scope === "shared" ? "Shared" : "Personal"}
            </span>
            {!item.is_active ? <span className="rounded-full bg-coral/15 px-2 py-0.5 text-xs font-semibold text-coral">Inactive</span> : null}
          </div>
          <p className="mt-1 text-sm text-ink/60">{memberNames.get(item.owner_user_id) ?? "Household member"}</p>
          <p className="mt-2 text-sm font-medium text-ink">
            {amountDetail(item)} <span className="font-normal text-ink/55">- {monthlyLabel(item)}</span>
          </p>
          {item.notes ? <p className="mt-2 line-clamp-2 rounded-xl bg-white px-3 py-2 text-sm leading-6 text-ink/70">{item.notes}</p> : null}
        </div>
        <div className="flex shrink-0 gap-1">
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
  );

  const planSections = [
    { title: "Income by member", items: incomeItems, empty: "No income items yet." },
    { title: "Personal bills and direct debits", items: personalBillItems, empty: "No personal bills or direct debits yet." },
    { title: "Shared household expenses", items: sharedExpenseItems, empty: "No shared household expenses yet." },
    { title: "Debt repayments", items: debtItems, empty: "No debt repayments yet." },
    { title: "Savings and buffer", items: savingsItems, empty: "No savings or buffer items yet." },
    { title: "Needs amount", items: needsAmountItems, empty: "No items need an amount." },
  ];

  return (
    <div className="pb-24 md:pb-0">
      {toast ? <Toast message={toast} /> : null}
      <PageHeader
        eyebrow={formatMonthLabel(monthStart)}
        title="Monthly money plan"
        description="Add income, bills, spending, and savings so MoneyMates can show what is left and where you can adjust."
        action={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <MonthSelector />
            <RefreshDataButton className="w-full sm:w-auto" />
            <Button className="w-full sm:w-auto" onClick={() => openForm()}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add item
            </Button>
          </div>
        }
      />

      {error && !showForm ? (
        <div className="mb-4">
          <WarningBanner tone="strong">{error}</WarningBanner>
        </div>
      ) : null}

      {budgetItemsLoadWarning ? (
        <div className="mb-4">
          <WarningBanner tone="strong">Budget items could not load. Your expenses and household data are still safe.</WarningBanner>
        </div>
      ) : null}

      {showingLegacyBudget ? (
        <Card className="mb-5">
          <p className="text-sm font-semibold text-moss">Existing monthly budget loaded</p>
          <p className="mt-2 text-sm leading-6 text-ink/65">
            This household still has legacy monthly totals. Add budget items to move the plan into member-owned income, bills, expenses, debts, and savings.
          </p>
        </Card>
      ) : null}

      {!hasBudgetItems ? (
        <Card className="mb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-moss">Start your monthly plan</p>
              <p className="mt-1 text-sm leading-6 text-ink/65">Add income first, then bills, shared expenses, debt repayments, and savings goals.</p>
            </div>
            <Button className="w-full sm:w-auto" onClick={() => openForm()}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add item
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Household monthly income", monthlyIncome],
          ["Personal bills total", personalBillsTotal],
          ["Shared expenses total", sharedExpensesTotal],
          ["Savings goal", savingsGoalTotal],
          ["Expected remaining", expectedRemaining],
          ["Actual spent this month", actualSpent],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-sm font-medium text-ink/60">{label}</p>
            <p className={`mt-2 text-2xl font-bold tracking-normal ${label === "Expected remaining" && Number(value) < 0 ? "text-coral" : "text-ink"}`}>
              {currency(Number(value))}
            </p>
          </Card>
        ))}
      </div>

      <Card className="mt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-moss">Money equation</p>
            <h2 className="mt-1 text-xl font-bold tracking-normal text-ink">Expected remaining</h2>
          </div>
          <p className={`text-xl font-bold ${expectedRemaining < 0 ? "text-coral" : "text-ink"}`}>{currency(expectedRemaining)}</p>
        </div>
        <div className="mt-4 space-y-3 text-sm">
          {[
            ["Income", monthlyIncome, ""],
            ["minus personal bills", personalBillsTotal, "-"],
            ["minus shared expenses", sharedExpensesTotal, "-"],
            ["minus debt repayments", debtRepaymentsTotal, "-"],
            ["minus savings goal", savingsGoalTotal, "-"],
          ].map(([label, value, prefix]) => (
            <div key={label} className="flex justify-between gap-4 rounded-xl bg-mist px-3 py-2">
              <span className="text-ink/65">{label}</span>
              <span className="font-bold text-ink">
                {prefix} {currency(Number(value))}
              </span>
            </div>
          ))}
          <div className="flex justify-between gap-4 border-t border-sage pt-3">
            <span className="font-semibold text-ink">equals expected remaining</span>
            <span className={`font-bold ${expectedRemaining < 0 ? "text-coral" : "text-ink"}`}>{currency(expectedRemaining)}</span>
          </div>
        </div>
      </Card>

      <section className="mt-5 space-y-4">
        {planSections.map((section) => (
          <Card key={section.title}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold tracking-normal text-ink">{section.title}</h2>
                <p className="mt-1 text-sm text-ink/60">
                  {section.items.length} item{section.items.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              {section.items.length ? section.items.map(renderBudgetItemCard) : (
                <p className="rounded-xl border border-dashed border-sage bg-mist px-4 py-5 text-sm text-ink/60">{section.empty}</p>
              )}
            </div>
          </Card>
        ))}
      </section>

      <div className="fixed bottom-20 left-4 right-4 z-20 md:hidden">
        <Button className="w-full shadow-soft" onClick={() => openForm()}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add item
        </Button>
      </div>

      {showForm ? (
        <div className="fixed inset-0 z-50 bg-ink/45 p-0 sm:p-4" role="dialog" aria-modal="true">
          <div className="flex min-h-full items-end justify-center sm:items-center">
            <section className="max-h-[100vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-soft sm:max-h-[92vh] sm:max-w-2xl sm:rounded-2xl sm:p-5">
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-moss">{editingId ? "Edit item" : "New item"}</p>
                    <h2 className="mt-1 text-2xl font-bold tracking-normal text-ink">{editingId ? "Update budget item" : "Add budget item"}</h2>
                  </div>
                  <button type="button" className="rounded-xl p-2 text-ink/50 hover:bg-sage/60" aria-label="Close form" onClick={cancelForm}>
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>

                {error ? <WarningBanner tone="strong">{error}</WarningBanner> : null}

                <div>
                  <p className="text-sm font-semibold text-moss">Step 1</p>
                  <h3 className="mt-1 text-lg font-bold tracking-normal text-ink">What is this item?</h3>
                  <div className="mt-3 grid gap-3">
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

                    <label>
                      <span className="mb-1.5 block text-sm font-semibold text-ink">Use common item</span>
                      <select
                        className={inputClass}
                        value=""
                        onChange={(event) => {
                          const template = COMMON_TEMPLATES.find((item) => item.itemName === event.target.value);
                          if (template) applyTemplate(template);
                        }}
                      >
                        <option value="">Choose a common item</option>
                        {COMMON_TEMPLATES.map((template) => (
                          <option key={template.itemName} value={template.itemName}>
                            {template.itemName}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-moss">Step 2</p>
                  <h3 className="mt-1 text-lg font-bold tracking-normal text-ink">What type is it?</h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {TYPE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`min-h-16 rounded-xl border px-3 py-3 text-left transition ${
                          form.type === option.value ? "border-navy bg-navy text-white" : "border-sage bg-mist text-ink hover:border-moss"
                        }`}
                        onClick={() => setForm((current) => ({ ...current, type: option.value }))}
                      >
                        <span className="block font-semibold">{option.label}</span>
                        <span className={`mt-1 block text-xs ${form.type === option.value ? "text-white/75" : "text-ink/60"}`}>{option.help}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-moss">Step 3</p>
                  <h3 className="mt-1 text-lg font-bold tracking-normal text-ink">Who owns or pays it?</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <FormField label="Personal or shared">
                      <select
                        className={inputClass}
                        value={form.scope}
                        onChange={(event) => {
                          const scope = event.target.value as BudgetItemScope;
                          setForm((current) => ({
                            ...current,
                            scope,
                            payerUserId: current.payerUserId || current.ownerUserId || defaultMemberId,
                          }));
                        }}
                      >
                        <option value="personal">Personal item</option>
                        <option value="shared">Shared household item</option>
                      </select>
                    </FormField>

                    <FormField label="Owner / entered for">
                      <select
                        className={inputClass}
                        value={form.ownerUserId}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            ownerUserId: event.target.value,
                            payerUserId: current.payerUserId || event.target.value,
                          }))
                        }
                      >
                        <option value="">Choose member</option>
                        {memberOptions.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.label}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField label="Usually paid by">
                      <select
                        className={inputClass}
                        value={form.payerUserId}
                        onChange={(event) => setForm((current) => ({ ...current, payerUserId: event.target.value }))}
                      >
                        <option value="">No usual payer yet</option>
                        {memberOptions.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.label}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <div className="rounded-xl border border-sage bg-mist px-3 py-3 text-sm leading-6 text-ink/65">
                      <span className="font-semibold text-ink">Counted status: </span>
                      {form.isActive && !form.needsAmount && form.type !== "info" ? "Counted when an amount is set." : "Not counted until active, counted type, and amount are set."}
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-moss">Step 4</p>
                  <h3 className="mt-1 text-lg font-bold tracking-normal text-ink">Amount and frequency</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
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

                    <FormField label="Quantity">
                      <input
                        className={inputClass}
                        inputMode="decimal"
                        min="0.01"
                        value={form.quantity}
                        onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
                      />
                    </FormField>

                    <label className="flex min-h-14 items-start gap-3 rounded-xl border border-sage bg-mist p-3 text-sm font-semibold text-ink">
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
                        <span className="block text-xs font-normal leading-5 text-ink/60">Visible, but not counted in totals.</span>
                      </span>
                    </label>
                  </div>

                  <div className="mt-3 rounded-xl border border-sage bg-white px-4 py-3">
                    <p className="text-sm font-semibold text-ink">Monthly equivalent</p>
                    <p className={`mt-1 text-xl font-bold tracking-normal ${formMonthlyEquivalent === "Needs amount" ? "text-coral" : "text-ink"}`}>
                      {formMonthlyEquivalent}
                    </p>
                    <div className="mt-2 grid gap-1 text-xs text-ink/55 sm:grid-cols-2">
                      <span>$185 quarterly = $61.67/month</span>
                      <span>$22 weekly x 2 = $190.67/month</span>
                      <span>$700 yearly = $58.33/month</span>
                      <span>Empty amount = Needs amount</span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-moss">Step 5</p>
                  <h3 className="mt-1 text-lg font-bold tracking-normal text-ink">Optional details</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
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

                    <FormField label="Start date">
                      <input
                        className={inputClass}
                        type="date"
                        value={form.startDate}
                        onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
                      />
                    </FormField>

                    <label className="flex min-h-14 items-start gap-3 rounded-xl border border-sage bg-mist p-3 text-sm font-semibold text-ink sm:col-span-2">
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

                    <div className="sm:col-span-2">
                      <FormField label="Notes">
                        <textarea
                          className={`${inputClass} min-h-24 resize-none`}
                          value={form.notes}
                          onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                          placeholder="Optional detail"
                        />
                      </FormField>
                    </div>
                  </div>
                </div>

                <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-sage bg-white px-4 py-3 sm:static sm:mx-0 sm:flex-row sm:border-0 sm:px-0 sm:py-0">
                  <Button type="submit" className="w-full sm:w-auto" loading={saving}>
                    <Save className="h-4 w-4" aria-hidden="true" />
                    Save item
                  </Button>
                  <Button type="button" className="w-full sm:w-auto" variant="ghost" onClick={cancelForm}>
                    Cancel
                  </Button>
                </div>
              </form>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
