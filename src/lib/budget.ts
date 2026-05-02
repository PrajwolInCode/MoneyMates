import type {
  AiInsight,
  BudgetItem,
  BudgetLimit,
  BudgetMonth,
  Category,
  Expense,
  Household,
  HouseholdMember,
  MonthlyCoachPayload,
  RecurringPayment,
} from "../types";
import { daysLeftInMonth } from "./date";
import { personName } from "./format";

export function limitAmountForCategory(limits: BudgetLimit[], categoryId: string) {
  return Number(limits.find((limit) => limit.category_id === categoryId)?.amount ?? 0);
}

export function totalBudget(budgetMonth: BudgetMonth | null, limits: BudgetLimit[]) {
  const categoryTotal = limits.reduce((sum, limit) => sum + Number(limit.amount), 0);
  return categoryTotal > 0 ? categoryTotal : Number(budgetMonth?.planned_budget ?? 0);
}

export function totalSpent(expenses: Expense[]) {
  return expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
}

export function spendingByCategory(expenses: Expense[], categories: Category[], limits: BudgetLimit[]) {
  return categories
    .map((category) => {
      const spent = expenses
        .filter((expense) => expense.category_id === category.id)
        .reduce((sum, expense) => sum + Number(expense.amount), 0);
      const limit = limitAmountForCategory(limits, category.id);
      return {
        id: category.id,
        category: category.name,
        color: category.color,
        spent,
        limit,
        remaining: Math.max(0, limit - spent),
        ratio: limit > 0 ? spent / limit : 0,
      };
    })
    .filter((item) => item.spent > 0 || item.limit > 0)
    .sort((a, b) => b.spent - a.spent);
}

export function spendingByPerson(expenses: Expense[], members: HouseholdMember[]) {
  return members
    .map((member, index) => {
      const spent = expenses
        .filter((expense) => expense.user_id === member.user_id)
        .reduce((sum, expense) => sum + Number(expense.amount), 0);
      return {
        id: member.user_id,
        name: personName(member.profile?.display_name, member.profile?.email ?? `Member ${index + 1}`),
        spent,
      };
    })
    .sort((a, b) => b.spent - a.spent);
}

export function monthlyAmountForBudgetItem(item: Pick<BudgetItem, "amount" | "frequency" | "quantity" | "needs_amount">) {
  if (item.needs_amount || item.amount === null || item.amount === undefined || item.frequency === "unknown") {
    return null;
  }

  const amount = Number(item.amount);
  const quantity = Number(item.quantity || 1);
  if (!Number.isFinite(amount) || !Number.isFinite(quantity) || amount < 0 || quantity <= 0) {
    return null;
  }

  switch (item.frequency) {
    case "weekly":
      return (amount * quantity * 52) / 12;
    case "fortnightly":
      return (amount * quantity * 26) / 12;
    case "monthly":
      return amount * quantity;
    case "quarterly":
      return (amount * quantity) / 3;
    case "yearly":
      return (amount * quantity) / 12;
    case "one_time":
      return amount * quantity;
    default:
      return null;
  }
}

type BudgetDuplicateCandidate = Pick<
  BudgetItem,
  "item_name" | "category" | "type" | "amount" | "frequency" | "quantity" | "needs_amount" | "scope" | "owner_user_id" | "created_by" | "is_active"
> & {
  id?: string;
  archived_at?: string | null;
};

export type BudgetDuplicateGroup = {
  key: string;
  label: string;
  reason: "same_shared_item" | "same_member_item";
  monthlyAmount: number | null;
  items: BudgetItem[];
};

export type ExpenseDuplicateGroup = {
  key: string;
  label: string;
  amount: number;
  expenses: Expense[];
};

function normalizedDuplicateText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function roundedMoneyKey(value: number | null) {
  return value === null ? "unknown" : String(Math.round(value * 100));
}

function duplicateKeyForBudgetItem(item: BudgetDuplicateCandidate) {
  if (!item.is_active || item.archived_at || item.type === "info") return null;
  const itemName = normalizedDuplicateText(item.item_name);
  if (!itemName) return null;
  const category = normalizedDuplicateText(item.category);
  const monthlyAmount = monthlyAmountForBudgetItem(item);
  const amountKey = roundedMoneyKey(monthlyAmount);

  if (item.scope === "shared" && item.type !== "income") {
    return {
      key: `shared|${item.type}|${itemName}|${category}|${amountKey}`,
      reason: "same_shared_item" as const,
      monthlyAmount,
    };
  }

  const ownerKey = item.owner_user_id || item.created_by || "unknown";
  return {
    key: `owner|${ownerKey}|${item.type}|${itemName}|${category}|${amountKey}`,
    reason: "same_member_item" as const,
    monthlyAmount,
  };
}

export function findPotentialDuplicateBudgetItems(items: BudgetItem[]): BudgetDuplicateGroup[] {
  const groups = new Map<string, BudgetDuplicateGroup>();

  items.forEach((item) => {
    const duplicateKey = duplicateKeyForBudgetItem(item);
    if (!duplicateKey) return;
    const existing = groups.get(duplicateKey.key);
    if (existing) {
      existing.items.push(item);
      return;
    }
    groups.set(duplicateKey.key, {
      key: duplicateKey.key,
      label: item.item_name,
      reason: duplicateKey.reason,
      monthlyAmount: duplicateKey.monthlyAmount,
      items: [item],
    });
  });

  return Array.from(groups.values())
    .filter((group) => group.items.length > 1)
    .sort((first, second) => second.items.length - first.items.length || first.label.localeCompare(second.label));
}

export function findSimilarBudgetItems(candidate: BudgetDuplicateCandidate, items: BudgetItem[], excludeId?: string | null) {
  const duplicateKey = duplicateKeyForBudgetItem(candidate);
  if (!duplicateKey) return [];
  return items.filter((item) => item.id !== excludeId && duplicateKeyForBudgetItem(item)?.key === duplicateKey.key);
}

export function budgetItemsForMonthlyTotals(items: BudgetItem[]) {
  const duplicateIds = new Set<string>();
  findPotentialDuplicateBudgetItems(items).forEach((group) => {
    group.items.slice(1).forEach((item) => duplicateIds.add(item.id));
  });
  return items.filter((item) => !duplicateIds.has(item.id));
}

export function findPotentialDuplicateExpenses(expenses: Expense[]): ExpenseDuplicateGroup[] {
  const groups = new Map<string, ExpenseDuplicateGroup>();

  expenses.forEach((expense) => {
    const label = normalizedDuplicateText(expense.merchant || expense.note || expense.category?.name || "expense");
    const category = normalizedDuplicateText(expense.category?.name);
    const amount = Number(expense.amount);
    const amountKey = roundedMoneyKey(Number.isFinite(amount) ? amount : null);
    const key = `${expense.spent_on}|${expense.category_id}|${category}|${label}|${amountKey}`;
    const existing = groups.get(key);
    if (existing) {
      existing.expenses.push(expense);
      return;
    }
    groups.set(key, {
      key,
      label: expense.merchant || expense.note || expense.category?.name || "Expense",
      amount,
      expenses: [expense],
    });
  });

  return Array.from(groups.values())
    .filter((group) => group.expenses.length > 1)
    .sort((first, second) => second.expenses.length - first.expenses.length || first.label.localeCompare(second.label));
}

export function budgetItemNeedsAmount(item: Pick<BudgetItem, "amount" | "needs_amount">) {
  return item.needs_amount || item.amount === null || item.amount === undefined;
}

export function totalBudgetItemMonthlyIncome(items: BudgetItem[]) {
  return budgetItemsForMonthlyTotals(items)
    .filter((item) => item.is_active && !item.archived_at && item.type === "income")
    .reduce((sum, item) => sum + (monthlyAmountForBudgetItem(item) ?? 0), 0);
}

export function totalBudgetItemMonthlyPlannedExpenses(items: BudgetItem[]) {
  return budgetItemsForMonthlyTotals(items)
    .filter((item) => item.is_active && !item.archived_at && item.type !== "income" && item.type !== "info")
    .reduce((sum, item) => sum + (monthlyAmountForBudgetItem(item) ?? 0), 0);
}

function itemMonthlyTotal(items: BudgetItem[], predicate: (item: BudgetItem) => boolean) {
  return items.filter(predicate).reduce((sum, item) => sum + (monthlyAmountForBudgetItem(item) ?? 0), 0);
}

export function dailyTrend(expenses: Expense[]) {
  const grouped = new Map<string, number>();
  expenses.forEach((expense) => grouped.set(expense.spent_on, (grouped.get(expense.spent_on) ?? 0) + Number(expense.amount)));
  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date: date.slice(5), amount }));
}

export function plannedVsActual(expenses: Expense[], categories: Category[], limits: BudgetLimit[]) {
  return spendingByCategory(expenses, categories, limits)
    .filter((item) => item.limit > 0 || item.spent > 0)
    .map((item) => ({
      category: item.category,
      Planned: item.limit,
      Actual: item.spent,
    }));
}

export function biggestCategory(expenses: Expense[], categories: Category[], limits: BudgetLimit[]) {
  return spendingByCategory(expenses, categories, limits)[0] ?? null;
}

export function buildCoachPayload(params: {
  household: Household;
  monthStart: string;
  budgetMonth: BudgetMonth | null;
  categories: Category[];
  limits: BudgetLimit[];
  expenses: Expense[];
  members: HouseholdMember[];
  recurringPayments: RecurringPayment[];
  budgetItems?: BudgetItem[];
}): MonthlyCoachPayload {
  const activeItems = (params.budgetItems ?? []).filter((item) => item.is_active && !item.archived_at);
  const activeItemsForTotals = budgetItemsForMonthlyTotals(activeItems);
  const duplicateGroups = findPotentialDuplicateBudgetItems(activeItems);
  const hasItemPlan = activeItems.length > 0;
  const itemPlannedBudget = hasItemPlan ? totalBudgetItemMonthlyPlannedExpenses(activeItemsForTotals) : 0;
  const plannedBudget = hasItemPlan ? itemPlannedBudget : totalBudget(params.budgetMonth, params.limits);
  const spent = totalSpent(params.expenses);
  const daysLeft = daysLeftInMonth(params.monthStart);
  const remainingBudget = Math.max(0, plannedBudget - spent);
  const categoryRows = spendingByCategory(params.expenses, params.categories, params.limits).map((item) => ({
    category: item.category,
    spent: item.spent,
    limit: item.limit,
    remaining: item.remaining,
  }));
  const memberName = (userId: string) => {
    const member = params.members.find((item) => item.user_id === userId);
    return personName(member?.profile?.display_name, member?.profile?.email ?? "Household member");
  };
  const fixedExpenses = itemMonthlyTotal(activeItemsForTotals, (item) => item.type === "fixed" || item.type === "debt");
  const sharedExpenses = itemMonthlyTotal(activeItemsForTotals, (item) => item.scope === "shared" && item.type !== "income" && item.type !== "info");
  const savingsGoal = itemMonthlyTotal(activeItemsForTotals, (item) => item.type === "saving" || item.type === "buffer");
  const personalExpensesByMember = params.members.map((member) => ({
    name: memberName(member.user_id),
    amount: itemMonthlyTotal(activeItemsForTotals, (item) => item.scope === "personal" && item.owner_user_id === member.user_id && item.type !== "income" && item.type !== "info"),
  }));
  const itemsNeedingAmount = activeItems
    .filter((item) => budgetItemNeedsAmount(item))
    .map((item) => ({ itemName: item.item_name, category: item.category, ownerName: memberName(item.owner_user_id) }));
  const possibleDuplicateBudgetItems = duplicateGroups.map((group) => ({
    label: group.label,
    reason: group.reason === "same_shared_item" ? "Shared item appears more than once" : "Same member appears to have repeated an item",
    monthlyAmount: group.monthlyAmount,
    members: group.items.map((item) => memberName(item.owner_user_id || item.created_by)),
  }));

  return {
    householdName: params.household.name,
    month: params.monthStart,
    totalIncome: hasItemPlan ? totalBudgetItemMonthlyIncome(activeItemsForTotals) : Number(params.budgetMonth?.total_income ?? 0),
    totalExpenses: plannedBudget,
    fixedExpenses,
    flexibleExpenses: Math.max(0, plannedBudget - fixedExpenses - savingsGoal),
    sharedExpenses,
    personalExpensesByMember,
    savingsGoal,
    actualExpensesThisMonth: spent,
    itemsNeedingAmount,
    possibleDuplicateBudgetItems,
    plannedBudget,
    totalSpent: spent,
    remainingBudget,
    safeDailySpend: remainingBudget / daysLeft,
    daysLeft,
    spendingByCategory: categoryRows,
    spendingByPerson: spendingByPerson(params.expenses, params.members).map(({ name, spent }) => ({ name, spent })),
    fixedPayments: params.recurringPayments.map((payment) => ({
      name: payment.name,
      amount: Number(payment.amount),
      dueDay: payment.due_day,
      category: params.categories.find((category) => category.id === payment.category_id)?.name ?? "Other",
    })),
  };
}

export function insightToCoachResponse(insight: AiInsight | null) {
  if (!insight) return null;
  return {
    summary: insight.summary,
    suggestions: insight.suggestions,
    warning: insight.warning,
    todayAction: insight.today_action,
  };
}
