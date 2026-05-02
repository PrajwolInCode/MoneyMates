import { FormEvent, useEffect, useMemo, useState } from "react";
import { Archive, Edit3, Lightbulb, Plus, Save, X } from "lucide-react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { FormField } from "../components/FormField";
import { inputClass } from "../components/inputs";
import { MonthSelector } from "../components/MonthSelector";
import { PageHeader } from "../components/PageHeader";
import { RefreshDataButton } from "../components/RefreshDataButton";
import { Toast } from "../components/Toast";
import { WarningBanner } from "../components/WarningBanner";
import { useHousehold } from "../contexts/HouseholdContext";
import {
  budgetItemNeedsAmount,
  monthlyAmountForBudgetItem,
  totalBudget,
  totalBudgetItemMonthlyIncome,
  totalBudgetItemMonthlyPlannedExpenses,
  totalSpent,
} from "../lib/budget";
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
  "Dining out",
  "Savings",
  "Buffer",
  "Other",
];

const ITEM_NAME_OPTIONS = [
  "Income",
  "Mortgage / Rent",
  "Car loan",
  "Credit card",
  "Groceries",
  "Utilities",
  "Petrol",
  "Insurance",
  "Phone",
  "Custom item",
];

const COMMON_TEMPLATES: BudgetTemplate[] = [
  { itemName: "Income", category: "Income", type: "income", frequency: "monthly" },
  { itemName: "Mortgage / Rent", category: "Housing", type: "fixed", frequency: "monthly" },
  { itemName: "Car loan", category: "Debt", type: "debt", frequency: "monthly" },
  { itemName: "Credit card", category: "Debt", type: "debt", frequency: "unknown", needsAmount: true },
  { itemName: "Groceries", category: "Food", type: "variable", frequency: "monthly" },
  { itemName: "Utilities", category: "Utilities", type: "fixed", frequency: "monthly" },
  { itemName: "Petrol", category: "Transport", type: "variable", frequency: "weekly" },
  { itemName: "Insurance", category: "Insurance", type: "fixed", frequency: "monthly" },
  { itemName: "Phone", category: "Phone", type: "fixed", frequency: "monthly" },
  { itemName: "Custom item", category: "Other", type: "variable", frequency: "monthly" },
];

const GROUPS: Array<{ key: BudgetGroupKey; label: string; simpleLabel: string; description: string }> = [
  { key: "income", label: "Income", simpleLabel: "Money coming in", description: "Wages, benefits, side income, or other money expected this month." },
  { key: "fixed", label: "Fixed bills", simpleLabel: "Bills and commitments", description: "Regular payments that usually stay steady." },
  { key: "debt", label: "Debt payments", simpleLabel: "Debt payments", description: "Loans, credit cards, and repayments." },
  { key: "variable", label: "Flexible spending", simpleLabel: "Flexible spending", description: "Food, fuel, outings, and other spending that can move." },
  { key: "saving", label: "Savings / buffer", simpleLabel: "Savings and buffer", description: "Money set aside for goals, emergencies, and breathing room." },
  { key: "needs_amount", label: "Needs amount", simpleLabel: "Needs amount", description: "Items still visible but not counted until an amount is added." },
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
    startDate: item.start_date ?? "",
    notes: item.notes ?? "",
    needsAmount: budgetItemNeedsAmount(item),
    isActive: item.is_active,
  };
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
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
    needsAmount: Boolean(template.needsAmount),
  };
}

export function BudgetPage() {
  const { budgetItems, budgetMonth, budgetLimits, expenses, monthStart, dataWarnings, saveBudgetItem, archiveBudgetItem } = useHousehold();
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
  const hasBudgetItems = activeItems.length > 0;
  const itemMonthlyIncome = useMemo(() => totalBudgetItemMonthlyIncome(activeItems), [activeItems]);
  const itemPlannedExpenses = useMemo(() => totalBudgetItemMonthlyPlannedExpenses(activeItems), [activeItems]);
  const legacyIncome = Number(budgetMonth?.total_income ?? 0);
  const legacyPlannedExpenses = totalBudget(budgetMonth, budgetLimits);
  const monthlyIncome = itemMonthlyIncome > 0 ? itemMonthlyIncome : legacyIncome;
  const plannedExpenses = itemPlannedExpenses > 0 ? itemPlannedExpenses : legacyPlannedExpenses;
  const actualSpent = totalSpent(expenses);
  const remaining = monthlyIncome - plannedExpenses;
  const needsAmountItems = activeItems.filter((item) => item.is_active && budgetItemNeedsAmount(item));
  const needsAmountCount = needsAmountItems.length;
  const showingLegacyBudget = !activeItems.length && (legacyIncome > 0 || legacyPlannedExpenses > 0);
  const budgetItemsLoadWarning = dataWarnings.find((warning) =>
    warning.includes("Budget items could not load. Your expenses and household data are still safe."),
  );

  const groupedItems = useMemo(() => {
    return activeItems.reduce<Record<BudgetGroupKey, BudgetItem[]>>(
      (groups, item) => {
        groups[groupForItem(item)].push(item);
        return groups;
      },
      { income: [], fixed: [], debt: [], variable: [], saving: [], needs_amount: [] },
    );
  }, [activeItems]);

  const sectionTotals = useMemo(() => {
    return GROUPS.reduce<Record<BudgetGroupKey, number>>(
      (totals, group) => {
        totals[group.key] = groupedItems[group.key].reduce((sum, item) => sum + monthlyValue(item), 0);
        return totals;
      },
      { income: 0, fixed: 0, debt: 0, variable: 0, saving: 0, needs_amount: 0 },
    );
  }, [groupedItems]);

  const actualByCategory = useMemo(() => {
    return expenses.reduce<Map<string, { label: string; actual: number }>>((map, expense) => {
      const label = expense.category?.name ?? "Other";
      const key = normalizeKey(label);
      const current = map.get(key) ?? { label, actual: 0 };
      current.actual += Number(expense.amount);
      map.set(key, current);
      return map;
    }, new Map());
  }, [expenses]);

  const comparisonRows = useMemo(() => {
    const planned = new Map<string, { category: string; planned: number; type: BudgetItemType | "unplanned" }>();

    activeItems.forEach((item) => {
      if (!item.is_active || item.archived_at || budgetItemNeedsAmount(item) || item.type === "income" || item.type === "info") return;
      const amount = monthlyAmountForBudgetItem(item);
      if (amount === null) return;
      const key = normalizeKey(item.category);
      const current = planned.get(key) ?? { category: item.category, planned: 0, type: item.type };
      current.planned += amount;
      if (current.type !== "variable" && item.type === "variable") current.type = "variable";
      planned.set(key, current);
    });

    actualByCategory.forEach((actualRow, key) => {
      if (!planned.has(key)) {
        planned.set(key, { category: actualRow.label, planned: 0, type: "unplanned" });
      }
    });

    return Array.from(planned.entries())
      .map(([key, row]) => {
        const actual = actualByCategory.get(key)?.actual ?? 0;
        return {
          category: row.category,
          planned: row.planned,
          actual,
          difference: row.planned - actual,
          type: row.type,
        };
      })
      .filter((row) => row.planned > 0 || row.actual > 0)
      .sort((first, second) => Math.abs(second.difference) - Math.abs(first.difference));
  }, [activeItems, actualByCategory]);

  const plannedFlexible = sectionTotals.variable;
  const actualFlexible = comparisonRows
    .filter((row) => row.type === "variable" || row.type === "unplanned")
    .reduce((sum, row) => sum + row.actual, 0);
  const flexibleDifference = plannedFlexible - actualFlexible;
  const potentialSaving = plannedFlexible > 0 ? Math.max(0, flexibleDifference) : Math.max(0, remaining);

  const healthInsight = useMemo(() => {
    if (!hasBudgetItems) return "Add your income first, then add regular bills and spending.";
    if (needsAmountCount > 0) return "Some items need an amount before this plan is complete.";
    if (monthlyIncome <= 0) return "Add income so MoneyMates can calculate what is left.";
    if (sectionTotals.fixed + sectionTotals.debt > monthlyIncome * 0.6) return "Fixed payments are taking most of the income.";
    if (plannedFlexible > 0 && actualFlexible > plannedFlexible) return "Flexible spending is the best place to adjust.";
    if (remaining > 0) return "You have room to save this month.";
    return "This plan is tight, so small flexible spending changes may help.";
  }, [actualFlexible, hasBudgetItems, monthlyIncome, needsAmountCount, plannedFlexible, remaining, sectionTotals.debt, sectionTotals.fixed]);

  const adjustmentOpportunities = useMemo(() => {
    const opportunities: string[] = [];
    const firstMissing = needsAmountItems[0];
    if (firstMissing) {
      opportunities.push(`${firstMissing.item_name} still needs an amount. Add it to complete the plan.`);
    }

    const overPlan = comparisonRows.find((row) => row.planned > 0 && row.actual > row.planned);
    if (overPlan) {
      opportunities.push(
        `${overPlan.category} is planned at ${currency(overPlan.planned)}/month. Actual spending is ${currency(overPlan.actual)}. Consider lowering this week's spend if that feels realistic.`,
      );
    }

    const closeToPlan = comparisonRows.find((row) => row.planned > 0 && row.actual <= row.planned && row.actual / row.planned >= 0.8);
    if (closeToPlan) {
      opportunities.push(`${closeToPlan.category} is tracking close to plan.`);
    }

    if (plannedFlexible > 0 && actualFlexible > plannedFlexible) {
      opportunities.push("You may be able to save more by adjusting flexible categories.");
    } else if (remaining > 0 && needsAmountCount === 0) {
      opportunities.push("You have room to save this month.");
    }

    if (!opportunities.length) {
      opportunities.push("Add a few planned items and MoneyMates will suggest calm places to adjust.");
    }

    return opportunities.slice(0, 4);
  }, [actualFlexible, comparisonRows, needsAmountCount, needsAmountItems, plannedFlexible, remaining]);

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
    setForm(template ? templateForm(template, monthStart) : { ...EMPTY_FORM, startDate: monthStart });
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
      needsAmount: Boolean(template.needsAmount),
    }));
  };

  const cancelForm = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, startDate: monthStart });
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

  const billTemplate = COMMON_TEMPLATES.find((item) => item.itemName === "Mortgage / Rent");
  const spendingTemplate = COMMON_TEMPLATES.find((item) => item.itemName === "Groceries");

  return (
    <div className="pb-24 md:pb-0">
      {toast ? <Toast message={toast} /> : null}
      <PageHeader
        eyebrow={formatMonthLabel(monthStart)}
        title="Monthly money plan"
        description="Plan your income, bills, spending, and savings for this month."
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
            This household has legacy budget data in budget months and category limits. It is still counted below; new manual items are saved separately.
          </p>
        </Card>
      ) : null}

      {!hasBudgetItems ? (
        <Card className="mb-5">
          <EmptyState
            title="Start your monthly plan"
            message="Add your income first, then add your regular bills and spending. MoneyMates will calculate what is left."
            action={
              <div className="grid gap-2 sm:grid-cols-3">
                <Button onClick={() => openForm(COMMON_TEMPLATES[0])}>Add income</Button>
                <Button variant="secondary" onClick={() => openForm(billTemplate)}>
                  Add bill
                </Button>
                <Button variant="secondary" onClick={() => openForm(spendingTemplate)}>
                  Add spending item
                </Button>
              </div>
            }
          />
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="p-4">
          <p className="text-sm font-medium text-ink/60">Monthly income</p>
          <p className="mt-2 text-2xl font-bold tracking-normal text-ink">{currency(monthlyIncome)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm font-medium text-ink/60">Planned expenses</p>
          <p className="mt-2 text-2xl font-bold tracking-normal text-ink">{currency(plannedExpenses)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm font-medium text-ink/60">Expected remaining</p>
          <p className={`mt-2 text-2xl font-bold tracking-normal ${remaining < 0 ? "text-coral" : "text-ink"}`}>{currency(remaining)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm font-medium text-ink/60">Actual spent this month</p>
          <p className="mt-2 text-2xl font-bold tracking-normal text-ink">{currency(actualSpent)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm font-medium text-ink/60">Potential saving</p>
          <p className="mt-2 text-2xl font-bold tracking-normal text-moss">{currency(potentialSaving)}</p>
        </Card>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-moss">Simple money equation</p>
              <h2 className="mt-1 text-xl font-bold tracking-normal text-ink">Left after plan</h2>
            </div>
            <p className={`text-xl font-bold ${remaining < 0 ? "text-coral" : "text-ink"}`}>{currency(remaining)}</p>
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-ink/65">Money coming in</span>
              <span className="font-bold text-ink">{currency(monthlyIncome)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-ink/65">minus Bills and commitments</span>
              <span className="font-bold text-ink">- {currency(sectionTotals.fixed)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-ink/65">minus Debt payments</span>
              <span className="font-bold text-ink">- {currency(sectionTotals.debt)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-ink/65">minus Flexible spending</span>
              <span className="font-bold text-ink">- {currency(sectionTotals.variable)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-ink/65">minus Savings and buffer</span>
              <span className="font-bold text-ink">- {currency(sectionTotals.saving)}</span>
            </div>
            <div className="border-t border-sage pt-3 flex justify-between gap-4">
              <span className="font-semibold text-ink">Left after plan</span>
              <span className={`font-bold ${remaining < 0 ? "text-coral" : "text-ink"}`}>{currency(remaining)}</span>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-sage p-2 text-navy">
              <Lightbulb className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-moss">Budget health</p>
              <h2 className="mt-1 text-xl font-bold tracking-normal text-ink">{healthInsight}</h2>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-mist px-3 py-3 text-sm text-ink/70">
            Planned flexible spending: <span className="font-semibold text-ink">{currency(plannedFlexible)}</span>
            <br />
            Actual flexible spending: <span className="font-semibold text-ink">{currency(actualFlexible)}</span>
            <br />
            Difference: <span className={`font-semibold ${flexibleDifference < 0 ? "text-coral" : "text-moss"}`}>{currency(flexibleDifference)}</span>
          </div>
        </Card>
      </div>

      <Card className="mt-5">
        <h2 className="text-xl font-bold tracking-normal text-ink">Adjustment opportunities</h2>
        <div className="mt-3 grid gap-2">
          {adjustmentOpportunities.map((item) => (
            <p key={item} className="rounded-xl bg-mist px-3 py-2 text-sm leading-6 text-ink/70">
              {item}
            </p>
          ))}
        </div>
      </Card>

      {comparisonRows.length ? (
        <Card className="mt-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-normal text-ink">Planned vs actual</h2>
              <p className="text-sm text-ink/60">Based on planned item categories and this month's expenses.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {comparisonRows.slice(0, 8).map((row) => (
              <div key={row.category} className="rounded-xl border border-sage bg-white px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{row.category}</p>
                    <p className="text-xs text-ink/60">
                      Planned {currency(row.planned)} - Actual {currency(row.actual)}
                    </p>
                  </div>
                  <p className={`text-sm font-bold ${row.difference < 0 ? "text-coral" : "text-moss"}`}>
                    {row.difference < 0 ? "Over" : "Under"} {currency(Math.abs(row.difference))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <section className="mt-5">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-normal text-ink">Your monthly plan</h2>
            <p className="text-sm text-ink/60">Income, bills, spending, savings, and items that still need an amount.</p>
          </div>
          <p className="text-sm font-semibold text-moss">
            {activeItems.length} item{activeItems.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="space-y-4">
          {GROUPS.map((group) => {
            const items = groupedItems[group.key];
            const total = sectionTotals[group.key];
            return (
              <Card key={group.key}>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-moss">{group.simpleLabel}</p>
                    <h3 className="mt-1 text-xl font-bold tracking-normal text-ink">{group.label}</h3>
                    <p className="mt-1 text-sm text-ink/60">{group.description}</p>
                  </div>
                  <p className="text-lg font-bold text-ink">{group.key === "needs_amount" ? `${items.length} item${items.length === 1 ? "" : "s"}` : currency(total)}</p>
                </div>

                {items.length ? (
                  <div className="mt-4 grid gap-3">
                    {items.map((item) => (
                      <div key={item.id} className={`rounded-xl border border-sage bg-mist px-3 py-3 ${item.is_active ? "" : "opacity-65"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-ink">{item.item_name}</p>
                              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-ink/70">{labelForType(item.type)}</span>
                              {!item.is_active ? <span className="rounded-full bg-coral/15 px-2 py-0.5 text-xs font-semibold text-coral">Inactive</span> : null}
                            </div>
                            <p className="mt-1 text-sm text-ink/60">
                              {item.category} - {amountDetail(item)}
                            </p>
                            {item.notes ? <p className="mt-2 rounded-xl bg-white px-3 py-2 text-sm leading-6 text-ink/70">{item.notes}</p> : null}
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
                        <p className={`mt-3 text-sm font-bold ${budgetItemNeedsAmount(item) ? "text-coral" : "text-ink"}`}>{monthlyLabel(item)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-sage bg-mist px-4 py-5 text-sm text-ink/60">
                    No items here yet.
                  </div>
                )}
              </Card>
            );
          })}
        </div>
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
                        placeholder="Mortgage / Rent"
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
                  <p className="text-sm font-semibold text-moss">Step 4</p>
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
