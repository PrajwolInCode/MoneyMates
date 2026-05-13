export type MemberRole = "owner" | "member";

export type Profile = {
  id: string;
  display_name: string;
  email: string;
  created_at: string;
  updated_at?: string;
};

export type Household = {
  id: string;
  name: string;
  owner_id: string;
  join_code: string;
  created_at: string;
  updated_at?: string;
};

export type HouseholdMember = {
  household_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
  budget_setup_completed_at?: string | null;
  profile?: Profile | null;
};

export type Category = {
  id: string;
  household_id: string;
  name: string;
  color: string;
  icon: string;
  is_default: boolean;
  created_at: string;
};

export type BudgetMonth = {
  id: string;
  household_id: string;
  month_start: string;
  total_income: number;
  planned_budget: number;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
};

export type BudgetLimit = {
  id: string;
  household_id: string;
  budget_month_id: string;
  category_id: string;
  amount: number;
  created_at: string;
  updated_at?: string;
};

export type BudgetItemType = "income" | "fixed" | "variable" | "debt" | "saving" | "buffer" | "info";

export type BudgetFrequency = "weekly" | "fortnightly" | "monthly" | "quarterly" | "yearly" | "one_time" | "unknown";

export type BudgetItemScope = "personal" | "shared";

export type BudgetItemKind =
  | "income"
  | "direct_debit"
  | "bill"
  | "debt_repayment"
  | "savings_goal"
  | "regular_expense"
  | "shared_expense"
  | "buffer"
  | "info";

export type BudgetItem = {
  id: string;
  household_id: string;
  owner_user_id: string;
  payer_user_id?: string | null;
  scope: BudgetItemScope;
  item_name: string;
  category: string;
  type: BudgetItemType;
  amount: number | null;
  frequency: BudgetFrequency;
  quantity: number;
  start_date?: string | null;
  notes?: string | null;
  needs_amount: boolean;
  is_active: boolean;
  item_scope: BudgetItemScope;
  budget_kind: BudgetItemKind;
  archived_at?: string | null;
  created_by: string;
  created_at: string;
  updated_at?: string;
  source_table?: "planned_budget_items" | "budget_items";
};

export type Expense = {
  id: string;
  household_id: string;
  category_id: string;
  user_id: string;
  amount: number;
  spent_on: string;
  merchant?: string | null;
  note?: string | null;
  card_id?: string | null;
  created_at: string;
  updated_at?: string;
  category?: Category | null;
  profile?: Profile | null;
};

export type RecurringPayment = {
  id: string;
  household_id: string;
  category_id: string;
  name: string;
  amount: number;
  due_day: number;
  cadence: "weekly" | "fortnightly" | "monthly" | "quarterly" | "yearly";
  next_due_on?: string | null;
  created_by: string;
  created_at: string;
  updated_at?: string;
  category?: Category | null;
};

export type CoachResponse = {
  summary: string;
  suggestions: string[];
  savingsIdea: string;
  needsVsWants: string;
  safeSpendingSuggestion: string;
  disclaimer: string;
  warning: string;
  todayAction: string;
};

export type AiInsight = {
  id: string;
  household_id: string;
  budget_month_id: string;
  summary: string;
  suggestions: string[];
  warning: string;
  today_action: string;
  created_by: string;
  created_at: string;
};

export type CategorySeed = {
  name: string;
  color: string;
  icon: string;
};

export type MonthlyCoachPayload = {
  householdName: string;
  month: string;
  totalIncome: number;
  totalExpenses: number;
  fixedExpenses: number;
  flexibleExpenses: number;
  sharedExpenses: number;
  personalExpensesByMember: Array<{ name: string; amount: number }>;
  savingsGoal: number;
  actualExpensesThisMonth: number;
  itemsNeedingAmount: Array<{ itemName: string; category: string; ownerName: string }>;
  possibleDuplicateBudgetItems: Array<{ label: string; reason: string; monthlyAmount: number | null; members: string[] }>;
  plannedBudget: number;
  totalSpent: number;
  remainingBudget: number;
  safeDailySpend: number;
  daysLeft: number;
  spendingByCategory: Array<{ category: string; spent: number; limit: number; remaining: number }>;
  spendingByPerson: Array<{ name: string; spent: number }>;
  fixedPayments: Array<{ name: string; amount: number; dueDay: number; category: string }>;
};

export type Notification = {
  id: string;
  household_id: string;
  user_id: string;
  actor_user_id?: string | null;
  type: string;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  read_at?: string | null;
  created_at: string;
};

export type ExpenseComment = {
  id: string;
  household_id: string;
  expense_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at?: string;
  profile?: Profile | null;
};
