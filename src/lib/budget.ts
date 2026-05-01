import type {
  AiInsight,
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
        name: personName(member.profile?.display_name, index === 0 ? "Praj" : "Wife"),
        spent,
      };
    })
    .sort((a, b) => b.spent - a.spent);
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
}): MonthlyCoachPayload {
  const plannedBudget = totalBudget(params.budgetMonth, params.limits);
  const spent = totalSpent(params.expenses);
  const daysLeft = daysLeftInMonth(params.monthStart);
  const remainingBudget = Math.max(0, plannedBudget - spent);
  const categoryRows = spendingByCategory(params.expenses, params.categories, params.limits).map((item) => ({
    category: item.category,
    spent: item.spent,
    limit: item.limit,
    remaining: item.remaining,
  }));

  return {
    householdName: params.household.name,
    month: params.monthStart,
    totalIncome: Number(params.budgetMonth?.total_income ?? 0),
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
