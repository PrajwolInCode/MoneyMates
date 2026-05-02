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

export function budgetItemNeedsAmount(item: Pick<BudgetItem, "amount" | "needs_amount">) {
  return item.needs_amount || item.amount === null || item.amount === undefined;
}

export function totalBudgetItemMonthlyIncome(items: BudgetItem[]) {
  return items
    .filter((item) => item.is_active && !item.archived_at && item.type === "income")
    .reduce((sum, item) => sum + (monthlyAmountForBudgetItem(item) ?? 0), 0);
}

export function totalBudgetItemMonthlyPlannedExpenses(items: BudgetItem[]) {
  return items
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
  const itemPlannedBudget = params.budgetItems?.length ? totalBudgetItemMonthlyPlannedExpenses(params.budgetItems) : 0;
  const plannedBudget = itemPlannedBudget > 0 ? itemPlannedBudget : totalBudget(params.budgetMonth, params.limits);
  const spent = totalSpent(params.expenses);
  const daysLeft = daysLeftInMonth(params.monthStart);
  const remainingBudget = Math.max(0, plannedBudget - spent);
  const categoryRows = spendingByCategory(params.expenses, params.categories, params.limits).map((item) => ({
    category: item.category,
    spent: item.spent,
    limit: item.limit,
    remaining: item.remaining,
  }));
  const activeItems = (params.budgetItems ?? []).filter((item) => item.is_active && !item.archived_at);
  const memberName = (userId: string) => {
    const member = params.members.find((item) => item.user_id === userId);
    return personName(member?.profile?.display_name, member?.profile?.email ?? "Household member");
  };
  const fixedExpenses = itemMonthlyTotal(activeItems, (item) => item.type === "fixed" || item.type === "debt");
  const sharedExpenses = itemMonthlyTotal(activeItems, (item) => item.scope === "shared" && item.type !== "income" && item.type !== "info");
  const savingsGoal = itemMonthlyTotal(activeItems, (item) => item.type === "saving" || item.type === "buffer");
  const personalExpensesByMember = params.members.map((member) => ({
    name: memberName(member.user_id),
    amount: itemMonthlyTotal(activeItems, (item) => item.scope === "personal" && item.owner_user_id === member.user_id && item.type !== "income" && item.type !== "info"),
  }));
  const itemsNeedingAmount = activeItems
    .filter((item) => budgetItemNeedsAmount(item))
    .map((item) => ({ itemName: item.item_name, category: item.category, ownerName: memberName(item.owner_user_id) }));

  return {
    householdName: params.household.name,
    month: params.monthStart,
    totalIncome: params.budgetItems?.length ? totalBudgetItemMonthlyIncome(params.budgetItems) : Number(params.budgetMonth?.total_income ?? 0),
    totalExpenses: plannedBudget,
    fixedExpenses,
    flexibleExpenses: Math.max(0, plannedBudget - fixedExpenses - savingsGoal),
    sharedExpenses,
    personalExpensesByMember,
    savingsGoal,
    actualExpensesThisMonth: spent,
    itemsNeedingAmount,
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
