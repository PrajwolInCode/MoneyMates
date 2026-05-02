import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Edit3, Plus, Save, Trash2, X } from "lucide-react";
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
  budgetItemsForMonthlyTotals,
  findPotentialDuplicateBudgetItems,
  findSimilarBudgetItems,
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

type AddChoice = {
  id: string;
  label: string;
  type: BudgetItemType;
  scope: BudgetItemScope;
  category: string;
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

const ADD_CHOICES: AddChoice[] = [
  { id: "income", label: "Income", type: "income", scope: "personal", category: "Income" },
  { id: "bill", label: "Bill/direct debit", type: "fixed", scope: "personal", category: "Bills" },
  { id: "debt", label: "Debt repayment", type: "debt", scope: "personal", category: "Debt" },
  { id: "shared_expense", label: "Shared expense", type: "variable", scope: "shared", category: "Shared household" },
  { id: "personal_expense", label: "Personal expense", type: "variable", scope: "personal", category: "Personal spending" },
  { id: "saving", label: "Savings goal", type: "saving", scope: "personal", category: "Savings" },
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

function typeLabel(type: BudgetItemType, scope: BudgetItemScope) {
  if (type === "income") return "income";
  if (type === "debt") return "debt repayment";
  if (type === "saving" || type === "buffer") return "savings goal";
  if (scope === "shared") return "shared expense";
  if (type === "fixed") return "bill";
  return "budget item";
}

function amountSummary(form: BudgetFormState, amount: number | null, quantity: number) {
  if (form.needsAmount || amount === null) return "needs amount";
  const monthlyAmount = monthlyAmountForBudgetItem({
    amount,
    frequency: form.frequency,
    quantity,
    needs_amount: false,
  });
  return monthlyAmount === null ? labelForFrequency(form.frequency).toLowerCase() : `${currency(monthlyAmount)}/month`;
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
    scope: scopeForTemplate(template),
    needsAmount: Boolean(template.needsAmount),
  };
}

function scopeForTemplate(template: BudgetTemplate): BudgetItemScope {
  return ["Food", "Utilities", "Dining out", "Gifts", "Clothes"].includes(template.category) || template.itemName === "Mortgage / rent" ? "shared" : "personal";
}

function stepTitle(step: number) {
  if (step === 1) return "What are you adding?";
  if (step === 2) return "Who is this for?";
  if (step === 3) return "What is the item?";
  if (step === 4) return "Amount and frequency";
  return "Anything else?";
}

export function BudgetPage() {
  const { user } = useAuth();
  const {
    members,
    budgetItems,
    budgetMonth,
    budgetLimits,
    expenses,
    monthStart,
    dataWarnings,
    isOwner,
    saveBudgetItem,
    deleteBudgetItem,
    clearLegacyMonthlyBudget,
  } = useHousehold();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [formStep, setFormStep] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BudgetFormState>({ ...EMPTY_FORM, startDate: monthStart });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearingLegacy, setClearingLegacy] = useState(false);
  const [duplicateConfirmKey, setDuplicateConfirmKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const activeItems = useMemo(() => budgetItems.filter((item) => !item.archived_at), [budgetItems]);
  const activeItemsForTotals = useMemo(() => budgetItemsForMonthlyTotals(activeItems), [activeItems]);
  const duplicateGroups = useMemo(() => findPotentialDuplicateBudgetItems(activeItems), [activeItems]);
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

  const openAddChoice = useCallback((choice: AddChoice) => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      startDate: monthStart,
      ownerUserId: defaultMemberId,
      payerUserId: defaultMemberId,
      type: choice.type,
      scope: choice.scope,
      category: choice.category,
    });
    setFormStep(3);
    setError(null);
    setShowForm(true);
  }, [defaultMemberId, monthStart]);

  useEffect(() => {
    const addType = searchParams.get("add");
    if (!addType || showForm) return;
    const choice = ADD_CHOICES.find((item) => item.id === addType);
    if (!choice) return;
    openAddChoice(choice);
    setSearchParams({}, { replace: true });
  }, [openAddChoice, searchParams, setSearchParams, showForm]);
  const hasBudgetItems = activeItems.length > 0;
  const itemMonthlyIncome = useMemo(() => totalBudgetItemMonthlyIncome(activeItemsForTotals), [activeItemsForTotals]);
  const legacyIncome = Number(budgetMonth?.total_income ?? 0);
  const legacyPlannedExpenses = totalBudget(budgetMonth, budgetLimits);
  const hasLegacyMonthlyTotals = legacyIncome > 0 || legacyPlannedExpenses > 0 || budgetLimits.length > 0;
  const actualSpent = totalSpent(expenses);
  const monthlyIncome = activeItems.length ? itemMonthlyIncome : legacyIncome;
  const showingLegacyBudget = !activeItems.length && hasLegacyMonthlyTotals;
  const hasBudgetData = hasBudgetItems || showingLegacyBudget || actualSpent > 0;
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

  const personalBillsTotal = activeItemsForTotals
    .filter(
      (item) =>
        item.scope === "personal" &&
        !budgetItemNeedsAmount(item) &&
        item.type !== "income" &&
        item.type !== "debt" &&
        item.type !== "saving" &&
        item.type !== "buffer",
    )
    .reduce((sum, item) => sum + monthlyValue(item), 0);
  const sharedExpensesTotal = activeItemsForTotals
    .filter(
      (item) =>
        item.scope === "shared" &&
        !budgetItemNeedsAmount(item) &&
        item.type !== "income" &&
        item.type !== "debt" &&
        item.type !== "saving" &&
        item.type !== "buffer",
    )
    .reduce((sum, item) => sum + monthlyValue(item), 0);
  const debtRepaymentsTotal = activeItemsForTotals.filter((item) => item.type === "debt" && !budgetItemNeedsAmount(item)).reduce((sum, item) => sum + monthlyValue(item), 0);
  const savingsGoalTotal = activeItemsForTotals
    .filter((item) => (item.type === "saving" || item.type === "buffer") && !budgetItemNeedsAmount(item))
    .reduce((sum, item) => sum + monthlyValue(item), 0);
  const plannedOutflowTotal = personalBillsTotal + sharedExpensesTotal + debtRepaymentsTotal + savingsGoalTotal;
  const plannedRemaining = monthlyIncome - plannedOutflowTotal;
  const actualRemaining = monthlyIncome - actualSpent;
  const hasActualSpending = actualSpent > 0;
  const budgetSummaryCards = [
    { label: "Household monthly income", value: monthlyIncome, show: monthlyIncome > 0 },
    { label: "Planned commitments", value: plannedOutflowTotal, show: plannedOutflowTotal > 0 },
    { label: "Planned remaining", value: plannedRemaining, show: monthlyIncome > 0 || plannedOutflowTotal > 0 },
    { label: "Actual spent this month", value: actualSpent, show: actualSpent > 0 },
    { label: "Actual left after spending", value: actualRemaining, show: monthlyIncome > 0 || actualSpent > 0 },
  ].filter((item) => item.show);
  const plannedEquationRows = [
    { label: "Income", value: monthlyIncome, prefix: "", show: monthlyIncome > 0 },
    { label: "minus personal bills", value: personalBillsTotal, prefix: "-", show: personalBillsTotal > 0 },
    { label: "minus shared expenses", value: sharedExpensesTotal, prefix: "-", show: sharedExpensesTotal > 0 },
    { label: "minus debt repayments", value: debtRepaymentsTotal, prefix: "-", show: debtRepaymentsTotal > 0 },
    { label: "minus savings goal", value: savingsGoalTotal, prefix: "-", show: savingsGoalTotal > 0 },
  ].filter((item) => item.show);
  const actualEquationRows = [
    { label: "Income", value: monthlyIncome, prefix: "", show: monthlyIncome > 0 },
    { label: "minus tracked spending", value: actualSpent, prefix: "-", show: actualSpent > 0 },
  ].filter((item) => item.show);
  const moneyEquationRows = hasActualSpending ? actualEquationRows : plannedEquationRows;
  const moneyEquationTotal = hasActualSpending ? actualRemaining : plannedRemaining;
  const moneyEquationTitle = hasActualSpending ? "Actual left after spending" : "Planned remaining";
  const duplicateItemsSkippedInTotals = duplicateGroups.reduce((sum, group) => sum + Math.max(0, group.items.length - 1), 0);

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

  const formDuplicateMatches = useMemo(() => {
    if (!showForm || !form.itemName.trim() || !form.category.trim() || !form.ownerUserId) return [];
    const parsedAmount = form.needsAmount || form.amount.trim() === "" ? null : Number(form.amount);
    const parsedQuantity = Number(form.quantity);
    if (parsedAmount !== null && (!Number.isFinite(parsedAmount) || parsedAmount < 0)) return [];
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) return [];
    return findSimilarBudgetItems(
      {
        item_name: form.itemName.trim(),
        category: form.category.trim(),
        type: form.type,
        amount: parsedAmount,
        frequency: form.frequency,
        quantity: parsedQuantity,
        needs_amount: form.needsAmount || parsedAmount === null,
        scope: form.scope,
        owner_user_id: form.ownerUserId,
        created_by: form.ownerUserId,
        is_active: form.isActive,
        archived_at: null,
      },
      activeItems,
      editingId,
    );
  }, [
    activeItems,
    editingId,
    form.amount,
    form.category,
    form.frequency,
    form.isActive,
    form.itemName,
    form.needsAmount,
    form.ownerUserId,
    form.quantity,
    form.scope,
    form.type,
    showForm,
  ]);

  const openForm = (template?: BudgetTemplate) => {
    setEditingId(null);
    const nextForm = template ? templateForm(template, monthStart) : { ...EMPTY_FORM, startDate: monthStart };
    setForm({
      ...nextForm,
      ownerUserId: defaultMemberId,
      payerUserId: defaultMemberId,
    });
    setFormStep(1);
    setError(null);
    setShowForm(true);
  };

  const startEdit = (item: BudgetItem) => {
    setEditingId(item.id);
    setForm(formFromItem(item));
    setFormStep(1);
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
      scope: scopeForTemplate(template),
      needsAmount: Boolean(template.needsAmount),
    }));
  };

  const applyAddChoice = (choice: AddChoice) => {
    setForm((current) => ({
      ...current,
      type: choice.type,
      scope: choice.scope,
      category: choice.category,
      ownerUserId: current.ownerUserId || defaultMemberId,
      payerUserId: current.payerUserId || defaultMemberId,
    }));
  };

  const goToNextFormStep = () => {
    setError(null);
    if (formStep === 2 && !form.ownerUserId) {
      setError("Choose who this item is for.");
      return;
    }
    if (formStep === 3 && !form.itemName.trim()) {
      setError("Enter an item name.");
      return;
    }
    setFormStep((current) => Math.min(5, current + 1));
  };

  const cancelForm = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, startDate: monthStart, ownerUserId: defaultMemberId, payerUserId: defaultMemberId });
    setFormStep(1);
    setDuplicateConfirmKey(null);
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

    const duplicateKey = `${form.ownerUserId}|${form.scope}|${form.type}|${itemName.toLowerCase()}|${category.toLowerCase()}|${parsedAmount ?? "unknown"}|${form.frequency}|${parsedQuantity}`;
    const duplicateMatches = findSimilarBudgetItems(
      {
        item_name: itemName,
        category,
        type: form.type,
        amount: parsedAmount,
        frequency: form.frequency,
        quantity: parsedQuantity,
        needs_amount: form.needsAmount || parsedAmount === null,
        scope: form.scope,
        owner_user_id: form.ownerUserId,
        created_by: form.ownerUserId,
        is_active: form.isActive,
        archived_at: null,
      },
      activeItems,
      editingId,
    );
    if (duplicateMatches.length && duplicateConfirmKey !== duplicateKey) {
      setDuplicateConfirmKey(duplicateKey);
      setError(`This looks similar to "${duplicateMatches[0].item_name}". Save again only if this is a separate income, bill, or expense.`);
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
      const action = editingId ? "Updated" : "Added";
      setToast(`${action} ${typeLabel(form.type, form.scope)}: ${itemName} (${amountSummary(form, parsedAmount, parsedQuantity)}).`);
      setDuplicateConfirmKey(null);
      cancelForm();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save budget item.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: BudgetItem) => {
    const confirmed = window.confirm(`Remove "${item.item_name}" from the household budget? This deletes the item for everyone.`);
    if (!confirmed) return;
    setDeletingId(item.id);
    setError(null);
    try {
      await deleteBudgetItem(item.id);
      setToast("Budget item removed.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove budget item.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearLegacy = async () => {
    const confirmed = window.confirm("Clear the old monthly income, plan amount, and category limits for this month? Member-owned budget items and transactions will stay.");
    if (!confirmed) return;
    setClearingLegacy(true);
    setError(null);
    try {
      await clearLegacyMonthlyBudget();
      setToast("Old monthly totals cleared.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not clear old monthly totals.");
    } finally {
      setClearingLegacy(false);
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
            aria-label={`Remove ${item.item_name}`}
            disabled={deletingId === item.id}
            onClick={() => void handleDelete(item)}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
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
  const visiblePlanSections = planSections.filter((section) => section.items.length > 0);

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

      {hasLegacyMonthlyTotals ? (
        <Card className="mb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-moss">{activeItems.length ? "Old monthly totals found" : "Existing monthly budget loaded"}</p>
              <h2 className="mt-1 text-xl font-bold tracking-normal text-ink">
                {activeItems.length ? "The old plan amount is not counted now." : "These old totals are being used until you add itemized budget data."}
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink/65">
                Clear this if it came from the first build or no longer matches your household. Your member income, bills, shared expenses, savings, and transactions will stay.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:min-w-80">
              {legacyIncome > 0 ? (
                <div className="rounded-xl bg-mist px-3 py-3">
                  <p className="text-xs font-semibold uppercase text-ink/45">Old income</p>
                  <p className="mt-1 text-lg font-bold text-ink">{currency(legacyIncome)}</p>
                </div>
              ) : null}
              {legacyPlannedExpenses > 0 ? (
                <div className="rounded-xl bg-mist px-3 py-3">
                  <p className="text-xs font-semibold uppercase text-ink/45">Old plan</p>
                  <p className="mt-1 text-lg font-bold text-ink">{currency(legacyPlannedExpenses)}</p>
                </div>
              ) : null}
              {isOwner ? (
                <Button className="sm:col-span-2" variant="secondary" loading={clearingLegacy} onClick={() => void handleClearLegacy()}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Clear old totals
                </Button>
              ) : (
                <p className="rounded-xl bg-mist px-3 py-3 text-sm leading-6 text-ink/65 sm:col-span-2">Only the household owner can clear old monthly totals.</p>
              )}
            </div>
          </div>
        </Card>
      ) : null}

      {duplicateGroups.length ? (
        <Card className="mb-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-coral/10 p-2 text-coral">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-coral">Review possible duplicates</p>
              <h2 className="mt-1 text-xl font-bold tracking-normal text-ink">
                {duplicateItemsSkippedInTotals} repeated item{duplicateItemsSkippedInTotals === 1 ? "" : "s"} are counted once in totals.
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink/65">
                Keep both if they are genuinely separate payments. Remove the extra one if two members added the same household cost or the same income was entered twice.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {duplicateGroups.map((group) => (
              <div key={group.key} className="rounded-xl border border-coral/25 bg-coral/5 px-3 py-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-semibold text-ink">{group.label}</p>
                  <p className="text-sm font-semibold text-ink/70">
                    {group.monthlyAmount === null ? "Amount missing" : `${currency(group.monthlyAmount)}/month`}
                  </p>
                </div>
                <div className="mt-3 grid gap-2">
                  {group.items.map((item) => (
                    <div key={item.id} className="flex flex-col gap-2 rounded-lg bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-ink/70">
                        <span className="font-semibold text-ink">{item.item_name}</span> - {memberNames.get(item.owner_user_id) ?? "Household member"}
                      </p>
                      <div className="flex gap-2">
                        <Button type="button" variant="ghost" onClick={() => startEdit(item)}>
                          <Edit3 className="h-4 w-4" aria-hidden="true" />
                          Edit
                        </Button>
                        <Button type="button" variant="secondary" disabled={deletingId === item.id} onClick={() => void handleDelete(item)}>
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
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
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {ADD_CHOICES.map((choice) => (
              <button
                key={choice.id}
                type="button"
                className="rounded-xl border border-sage bg-mist px-3 py-3 text-left text-sm font-semibold text-ink hover:border-moss hover:bg-sage/60"
                onClick={() => openAddChoice(choice)}
              >
                {choice.label}
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      {hasBudgetData && budgetSummaryCards.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {budgetSummaryCards.map(({ label, value }) => (
            <Card key={label} className="p-4">
              <p className="text-sm font-medium text-ink/60">{label}</p>
              <p className={`mt-2 text-2xl font-bold tracking-normal ${label.includes("remaining") || label.includes("left") ? (Number(value) < 0 ? "text-coral" : "text-ink") : "text-ink"}`}>
                {currency(Number(value))}
              </p>
            </Card>
          ))}
        </div>
      ) : null}

      {hasBudgetData && moneyEquationRows.length ? (
      <Card className="mt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-moss">Money equation</p>
            <h2 className="mt-1 text-xl font-bold tracking-normal text-ink">{moneyEquationTitle}</h2>
          </div>
          <p className={`text-xl font-bold ${moneyEquationTotal < 0 ? "text-coral" : "text-ink"}`}>{currency(moneyEquationTotal)}</p>
        </div>
        <div className="mt-4 space-y-3 text-sm">
          {moneyEquationRows.map(({ label, value, prefix }) => (
            <div key={label} className="flex justify-between gap-4 rounded-xl bg-mist px-3 py-2">
              <span className="text-ink/65">{label}</span>
              <span className="font-bold text-ink">
                {prefix} {currency(Number(value))}
              </span>
            </div>
          ))}
          <div className="flex justify-between gap-4 border-t border-sage pt-3">
            <span className="font-semibold text-ink">equals {moneyEquationTitle.toLowerCase()}</span>
            <span className={`font-bold ${moneyEquationTotal < 0 ? "text-coral" : "text-ink"}`}>{currency(moneyEquationTotal)}</span>
          </div>
        </div>
      </Card>
      ) : null}

      {visiblePlanSections.length ? (
      <section className="mt-5 space-y-4">
        {visiblePlanSections.map((section) => (
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
      ) : null}

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
                {formDuplicateMatches.length ? (
                  <WarningBanner>
                    This looks similar to {formDuplicateMatches.map((item) => item.item_name).join(", ")}. Save it only if it is a separate payment or income.
                  </WarningBanner>
                ) : null}

                <div>
                  <p className="text-sm font-semibold text-moss">Step {formStep} of 5</p>
                  <h3 className="mt-1 text-lg font-bold tracking-normal text-ink">{stepTitle(formStep)}</h3>
                </div>

                {formStep === 1 ? (
                  <div className="grid gap-2">
                    {ADD_CHOICES.map((choice) => (
                      <button
                        key={choice.label}
                        type="button"
                        className={`rounded-xl border px-3 py-3 text-left font-semibold transition ${
                          form.type === choice.type && form.scope === choice.scope && form.category === choice.category
                            ? "border-navy bg-navy text-white"
                            : "border-sage bg-mist text-ink hover:border-moss"
                        }`}
                        onClick={() => applyAddChoice(choice)}
                      >
                        {choice.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                {formStep === 2 ? (
                  <div className="grid gap-2">
                    <button
                      type="button"
                      className={`rounded-xl border px-3 py-3 text-left font-semibold ${form.ownerUserId === defaultMemberId && form.scope === "personal" ? "border-navy bg-navy text-white" : "border-sage bg-mist text-ink"}`}
                      onClick={() => setForm((current) => ({ ...current, scope: "personal", ownerUserId: defaultMemberId, payerUserId: current.payerUserId || defaultMemberId }))}
                    >
                      Me
                    </button>
                    <button
                      type="button"
                      className={`rounded-xl border px-3 py-3 text-left font-semibold ${form.scope === "shared" ? "border-navy bg-navy text-white" : "border-sage bg-mist text-ink"}`}
                      onClick={() => setForm((current) => ({ ...current, scope: "shared", ownerUserId: defaultMemberId, payerUserId: current.payerUserId || defaultMemberId }))}
                    >
                      Shared household
                    </button>
                    {memberOptions.filter((member) => member.id !== defaultMemberId).map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        className={`rounded-xl border px-3 py-3 text-left font-semibold ${form.ownerUserId === member.id ? "border-navy bg-navy text-white" : "border-sage bg-mist text-ink"}`}
                        onClick={() => setForm((current) => ({ ...current, scope: "personal", ownerUserId: member.id, payerUserId: current.payerUserId || member.id }))}
                      >
                        {member.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                {formStep === 3 ? (
                  <div className="grid gap-3">
                    <FormField label="Item name">
                      <input className={inputClass} list="budget-item-name-options" value={form.itemName} onChange={(event) => setForm((current) => ({ ...current, itemName: event.target.value }))} placeholder="Mortgage / rent" />
                      <datalist id="budget-item-name-options">
                        {ITEM_NAME_OPTIONS.map((itemName) => <option key={itemName} value={itemName} />)}
                      </datalist>
                    </FormField>
                    <FormField label="Category">
                      <input className={inputClass} list="budget-category-options" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} placeholder="Housing" />
                      <datalist id="budget-category-options">
                        {CATEGORY_OPTIONS.map((category) => <option key={category} value={category} />)}
                      </datalist>
                    </FormField>
                    <label>
                      <span className="mb-1.5 block text-sm font-semibold text-ink">Common item</span>
                      <select className={inputClass} value="" onChange={(event) => {
                        const template = COMMON_TEMPLATES.find((item) => item.itemName === event.target.value);
                        if (template) applyTemplate(template);
                      }}>
                        <option value="">Choose a common item</option>
                        {COMMON_TEMPLATES.map((template) => <option key={template.itemName} value={template.itemName}>{template.itemName}</option>)}
                      </select>
                    </label>
                  </div>
                ) : null}

                {formStep === 4 ? (
                  <div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FormField label="Amount">
                        <input className={inputClass} inputMode="decimal" value={form.needsAmount ? "" : form.amount} disabled={form.needsAmount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder="Leave empty if unknown" />
                      </FormField>
                      <FormField label="Frequency">
                        <select className={inputClass} value={form.frequency} onChange={(event) => setForm((current) => ({ ...current, frequency: event.target.value as BudgetFrequency }))}>
                          {FREQUENCY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </FormField>
                      <FormField label="Quantity">
                        <input className={inputClass} inputMode="decimal" min="0.01" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} />
                      </FormField>
                      <label className="flex min-h-14 items-start gap-3 rounded-xl border border-sage bg-mist p-3 text-sm font-semibold text-ink">
                        <input className="mt-1 h-4 w-4 accent-navy" type="checkbox" checked={form.needsAmount} onChange={(event) => setForm((current) => ({ ...current, needsAmount: event.target.checked, amount: event.target.checked ? "" : current.amount }))} />
                        <span>Needs amount<span className="block text-xs font-normal leading-5 text-ink/60">Visible, but not counted in totals.</span></span>
                      </label>
                    </div>
                    <div className="mt-3 rounded-xl border border-sage bg-white px-4 py-3">
                      <p className="text-sm font-semibold text-ink">Monthly equivalent</p>
                      <p className={`mt-1 text-xl font-bold tracking-normal ${formMonthlyEquivalent === "Needs amount" ? "text-coral" : "text-ink"}`}>{formMonthlyEquivalent}</p>
                      <div className="mt-2 grid gap-1 text-xs text-ink/55 sm:grid-cols-2">
                        <span>$185 quarterly = $61.67/month</span>
                        <span>$22 weekly x 2 = $190.67/month</span>
                        <span>Empty amount = Needs amount</span>
                      </div>
                    </div>
                  </div>
                ) : null}

                {formStep === 5 ? (
                  <div className="grid gap-3">
                    <FormField label="Start date">
                      <input className={inputClass} type="date" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} />
                    </FormField>
                    <FormField label="Notes">
                      <textarea className={`${inputClass} min-h-28 resize-none`} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional detail" />
                    </FormField>
                  </div>
                ) : null}

                <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-sage bg-white px-4 py-3 sm:static sm:mx-0 sm:flex-row sm:border-0 sm:px-0 sm:py-0">
                  {formStep > 1 ? <Button type="button" className="w-full sm:w-auto" variant="secondary" onClick={() => setFormStep((current) => Math.max(1, current - 1))}>Back</Button> : null}
                  {formStep < 5 ? (
                    <Button type="button" className="w-full sm:w-auto" onClick={goToNextFormStep}>Next</Button>
                  ) : (
                    <Button type="submit" className="w-full sm:w-auto" loading={saving}>
                      <Save className="h-4 w-4" aria-hidden="true" />
                      Save to money plan
                    </Button>
                  )}
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
