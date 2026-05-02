import type { User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_CATEGORIES } from "../lib/constants";
import { addMonthsToMonthStart, getMonthBounds, getMonthStart } from "../lib/date";
import { sendHouseholdPhonePush } from "../lib/pushNotifications";
import { hasSupabaseEnv, supabase } from "../lib/supabase";
import type {
  AiInsight,
  BudgetFrequency,
  BudgetItem,
  BudgetItemKind,
  BudgetItemScope,
  BudgetItemType,
  BudgetLimit,
  BudgetMonth,
  Category,
  CoachResponse,
  Expense,
  ExpenseComment,
  Household,
  HouseholdMember,
  Notification,
  RecurringPayment,
} from "../types";
import { useAuth } from "./AuthContext";

type AddExpenseInput = {
  category_id: string;
  amount: number;
  spent_on: string;
  merchant?: string;
  note?: string;
};

type BudgetLimitInput = {
  category_id: string;
  amount: number;
};

type BudgetItemInput = {
  owner_user_id?: string;
  payer_user_id?: string | null;
  scope?: BudgetItemScope;
  item_name: string;
  category: string;
  type: BudgetItemType;
  amount: number | null;
  frequency: BudgetFrequency;
  quantity: number;
  item_scope?: BudgetItemScope;
  budget_kind?: BudgetItemKind;
  start_date?: string | null;
  notes?: string | null;
  needs_amount: boolean;
  is_active: boolean;
};

type DataLoadIssue =
  | "none"
  | "missing_env"
  | "no_household"
  | "missing_table"
  | "missing_column"
  | "rls_denied"
  | "wrong_project"
  | "network_error"
  | "schema_mismatch"
  | "load_failed";
type RefreshOptions = {
  throwOnError?: boolean;
};

type HouseholdContextValue = {
  household: Household | null;
  members: HouseholdMember[];
  categories: Category[];
  budgetMonth: BudgetMonth | null;
  budgetLimits: BudgetLimit[];
  budgetItems: BudgetItem[];
  expenses: Expense[];
  recurringPayments: RecurringPayment[];
  notifications: Notification[];
  expenseComments: ExpenseComment[];
  unreadNotificationCount: number;
  aiInsight: AiInsight | null;
  monthStart: string;
  selectedMonth: string;
  loading: boolean;
  error: string | null;
  loadIssue: DataLoadIssue;
  dataWarnings: string[];
  isOwner: boolean;
  setSelectedMonth: (monthStart: string) => void;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  refresh: (options?: RefreshOptions) => Promise<void>;
  createHousehold: (name: string) => Promise<void>;
  joinHousehold: (joinCode: string) => Promise<void>;
  addExpense: (input: AddExpenseInput) => Promise<void>;
  saveBudget: (input: { totalIncome: number; plannedBudget: number; limits: BudgetLimitInput[] }) => Promise<void>;
  saveBudgetItem: (input: BudgetItemInput, id?: string) => Promise<void>;
  archiveBudgetItem: (id: string) => Promise<void>;
  completeBudgetSetup: () => Promise<void>;
  createCategory: (name: string) => Promise<void>;
  saveRecurringPayment: (input: { name: string; amount: number; dueDay: number; categoryId: string }) => Promise<void>;
  deleteRecurringPayment: (id: string) => Promise<void>;
  saveAiInsight: (response: CoachResponse) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  addExpenseComment: (expenseId: string, body: string) => Promise<void>;
};

const HouseholdContext = createContext<HouseholdContextValue | undefined>(undefined);

function generateJoinCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function normalizeExpense(row: any): Expense {
  return {
    ...row,
    amount: Number(row.amount),
    category: row.categories ?? row.category ?? null,
    profile: row.profiles ?? row.profile ?? null,
  };
}

function normalizeMember(row: any): HouseholdMember {
  return {
    household_id: row.household_id,
    user_id: row.user_id,
    role: row.role,
    joined_at: row.joined_at,
    budget_setup_completed_at: row.budget_setup_completed_at ?? null,
    profile: row.profiles ?? row.profile ?? null,
  };
}

function normalizeRecurring(row: any): RecurringPayment {
  return {
    ...row,
    amount: Number(row.amount),
    category: row.categories ?? row.category ?? null,
  };
}

function defaultBudgetKind(type: BudgetItemType): BudgetItemKind {
  if (type === "income") return "income";
  if (type === "debt") return "debt_repayment";
  if (type === "saving") return "savings_goal";
  if (type === "buffer") return "buffer";
  if (type === "info") return "info";
  if (type === "fixed") return "bill";
  return "regular_expense";
}

function normalizeBudgetItemScope(value: unknown): BudgetItemScope {
  return value === "shared" ? "shared" : "personal";
}

function normalizeBudgetItemKind(value: unknown, type: BudgetItemType): BudgetItemKind {
  const allowed: BudgetItemKind[] = [
    "income",
    "direct_debit",
    "bill",
    "debt_repayment",
    "savings_goal",
    "regular_expense",
    "shared_expense",
    "buffer",
    "info",
  ];
  return allowed.includes(value as BudgetItemKind) ? (value as BudgetItemKind) : defaultBudgetKind(type);
}

function normalizeBudgetItem(row: any, sourceTable?: BudgetItem["source_table"]): BudgetItem {
  const amount = row.amount === null || row.amount === undefined ? null : Number(row.amount);
  const type = (row.type ?? row.item_type ?? "variable") as BudgetItemType;
  return {
    ...row,
    id: row.id,
    household_id: row.household_id,
    item_name: row.item_name ?? row.name ?? "Budget item",
    category: row.category ?? "Other",
    type,
  amount,
  frequency: row.frequency ?? "monthly",
  quantity: Number(row.quantity ?? 1),
    start_date: row.start_date ?? row.starts_on ?? null,
    notes: row.notes ?? null,
    needs_amount: row.needs_amount === null || row.needs_amount === undefined ? amount === null : Boolean(row.needs_amount),
    is_active: row.is_active === null || row.is_active === undefined ? true : Boolean(row.is_active),
  scope: normalizeBudgetItemScope(row.scope ?? row.item_scope),
  item_scope: normalizeBudgetItemScope(row.scope ?? row.item_scope),
  budget_kind: normalizeBudgetItemKind(row.budget_kind, type),
  archived_at: row.archived_at ?? null,
  created_by: row.created_by ?? "",
  owner_user_id: row.owner_user_id ?? row.created_by ?? "",
  payer_user_id: row.payer_user_id === undefined ? row.created_by ?? null : row.payer_user_id,
  source_table: sourceTable,
  };
}

function normalizeInsight(row: any): AiInsight {
  return {
    ...row,
    suggestions: Array.isArray(row.suggestions) ? row.suggestions : [],
  };
}

function errorMessage(caught: unknown) {
  if (caught instanceof Error) return caught.message;
  if (typeof caught === "object" && caught && "message" in caught) return String((caught as { message?: unknown }).message ?? "");
  return "";
}

function classifyLoadIssue(caught: unknown): DataLoadIssue {
  const message = errorMessage(caught).toLowerCase();
  const code = typeof caught === "object" && caught && "code" in caught ? String((caught as { code?: unknown }).code ?? "").toLowerCase() : "";

  if (message.includes("row-level security") || message.includes("permission denied") || code === "42501") return "rls_denied";
  if (message.includes("could not find the table") || code === "42p01" || code === "pgrst205") return "missing_table";
  if (message.includes("could not find") && message.includes("column")) return "missing_column";
  if (message.includes("column") && (message.includes("does not exist") || message.includes("schema cache")) || code === "42703" || code === "pgrst204") {
    return "missing_column";
  }
  if (message.includes("invalid api key") || message.includes("jwt") || code === "pgrst301") return "wrong_project";
  if (message.includes("failed to fetch") || message.includes("networkerror") || message.includes("network request failed")) return "network_error";
  if (message.includes("schema cache")) return "schema_mismatch";
  return "load_failed";
}

function isMissingRelation(caught: unknown) {
  const message = errorMessage(caught).toLowerCase();
  const code = typeof caught === "object" && caught && "code" in caught ? String((caught as { code?: unknown }).code ?? "").toLowerCase() : "";
  return message.includes("could not find the table") || code === "42p01" || code === "pgrst205";
}

function isMissingFunction(caught: unknown) {
  const message = errorMessage(caught).toLowerCase();
  const code = typeof caught === "object" && caught && "code" in caught ? String((caught as { code?: unknown }).code ?? "").toLowerCase() : "";
  return message.includes("could not find the function") || code === "42883" || code === "pgrst202";
}

function isMissingColumn(caught: unknown) {
  const message = errorMessage(caught).toLowerCase();
  const code = typeof caught === "object" && caught && "code" in caught ? String((caught as { code?: unknown }).code ?? "").toLowerCase() : "";
  return (
    code === "42703" ||
    code === "pgrst204" ||
    (message.includes("column") && (message.includes("does not exist") || message.includes("schema cache") || message.includes("could not find")))
  );
}

function warningForOptionalTable(tableName: string, caught: unknown) {
  if (isMissingRelation(caught)) return `${tableName} is not available in this Supabase schema.`;
  if (isMissingColumn(caught)) return `${tableName} has missing columns in this Supabase schema.`;
  if (classifyLoadIssue(caught) === "rls_denied") return `${tableName} is blocked by Supabase row level security.`;
  return `${tableName} could not load.`;
}

function uniqueTables(tables: Array<BudgetItem["source_table"] | undefined>) {
  return Array.from(new Set(tables.filter((table): table is NonNullable<BudgetItem["source_table"]> => Boolean(table))));
}

async function loadBudgetItemsForHousehold(householdId: string) {
  const warnings: string[] = [];
  const loadedById = new Map<string, BudgetItem>();
  const tableNames = ["planned_budget_items", "budget_items"];
  let hadBudgetItemError = false;

  for (const tableName of tableNames) {
    const { data, error: tableError } = await supabase
      .from(tableName)
      .select("*")
      .eq("household_id", householdId);

    if (tableError) {
      hadBudgetItemError = true;
      warnings.push(warningForOptionalTable(tableName, tableError));
      continue;
    }

    (data ?? [])
      .map((row: any) => normalizeBudgetItem(row, tableName as BudgetItem["source_table"]))
      .filter((item) => !item.archived_at)
      .forEach((item) => loadedById.set(item.id, item));
  }

  const data = Array.from(loadedById.values()).sort((first, second) => {
    const activeSort = Number(second.is_active) - Number(first.is_active);
    if (activeSort) return activeSort;
    const typeSort = first.type.localeCompare(second.type);
    if (typeSort) return typeSort;
    return first.item_name.localeCompare(second.item_name);
  });

  if (hadBudgetItemError) {
    warnings.unshift("Budget items could not load. Your expenses and household data are still safe.");
  }

  return { data, warnings: Array.from(new Set(warnings)) };
}

async function loadOptionalNotifications(householdId: string, userId: string) {
  const { data, error: notificationsError } = await supabase
    .from("notifications")
    .select("*")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(40);

  if (notificationsError) {
    if (isMissingRelation(notificationsError)) return { data: [] as Notification[], warning: "notifications is not available in this Supabase schema." };
    throw notificationsError;
  }

  return { data: (data ?? []) as Notification[], warning: null };
}

async function loadOptionalExpenseComments(householdId: string) {
  const { data, error: commentsError } = await supabase
    .from("expense_comments")
    .select("*,profiles(id,display_name,email,created_at,updated_at)")
    .eq("household_id", householdId)
    .order("created_at", { ascending: true });

  if (commentsError) {
    if (isMissingRelation(commentsError)) {
      return { data: [] as ExpenseComment[], warning: "expense_comments is not available in this Supabase schema." };
    }
    throw commentsError;
  }

  return { data: (data ?? []).map((row: any) => ({ ...row, profile: row.profiles ?? null })), warning: null };
}

async function loadOptionalRecurringPayments(householdId: string) {
  const { data, error: recurringError } = await supabase
    .from("recurring_payments")
    .select("*,categories(*)")
    .eq("household_id", householdId)
    .order("due_day", { ascending: true });

  if (recurringError) {
    if (isMissingRelation(recurringError)) {
      return { data: [] as RecurringPayment[], warning: "recurring_payments is not available in this Supabase schema." };
    }
    throw recurringError;
  }

  return { data: (data ?? []).map(normalizeRecurring), warning: null };
}

async function loadOptionalAiInsight(budgetMonthId: string) {
  const { data, error: insightError } = await supabase
    .from("ai_insights")
    .select("*")
    .eq("budget_month_id", budgetMonthId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (insightError) {
    if (isMissingRelation(insightError)) {
      return { data: null as AiInsight | null, warning: "ai_insights is not available in this Supabase schema." };
    }
    throw insightError;
  }

  return { data: data ? normalizeInsight(data) : null, warning: null };
}

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, refreshSession } = useAuth();
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgetMonth, setBudgetMonth] = useState<BudgetMonth | null>(null);
  const [budgetLimits, setBudgetLimits] = useState<BudgetLimit[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);
  const [aiInsight, setAiInsight] = useState<AiInsight | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [expenseComments, setExpenseComments] = useState<ExpenseComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadIssue, setLoadIssue] = useState<DataLoadIssue>("none");
  const [dataWarnings, setDataWarnings] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonthState] = useState(getMonthStart);
  const monthStart = selectedMonth;

  const isOwner = Boolean(household && user && household.owner_id === user.id);
  const currentUserLabel = () => user?.user_metadata.display_name || user?.email || "A household member";

  const clearHouseholdData = () => {
    setHousehold(null);
    setMembers([]);
    setCategories([]);
    setBudgetMonth(null);
    setBudgetLimits([]);
    setBudgetItems([]);
    setExpenses([]);
    setRecurringPayments([]);
    setAiInsight(null);
    setNotifications([]);
    setExpenseComments([]);
    setDataWarnings([]);
  };


  const ensureRecurringDueNotifications = async (target: Household, payments: RecurringPayment[], activeUser: User) => {
    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);
    for (const payment of payments) {
      const dueInDays = payment.due_day - today.getDate();
      if (dueInDays < 0 || dueInDays > 3) continue;
      const dedupeKey = `recurring_due_${payment.id}_${todayIso}`;
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("household_id", target.id)
        .eq("user_id", activeUser.id)
        .eq("type", "recurring_due")
        .contains("metadata", { dedupe_key: dedupeKey })
        .limit(1);
      if (existing && existing.length) continue;
      await supabase.from("notifications").insert({
        household_id: target.id,
        user_id: activeUser.id,
        actor_user_id: payment.created_by,
        type: "recurring_due",
        title: "Recurring payment is due soon",
        body: `${payment.name} is due in ${dueInDays} day${dueInDays === 1 ? "" : "s"}.`,
        metadata: { payment_id: payment.id, dedupe_key: dedupeKey },
      });
    }
  };
  const loadHouseholdData = async (target: Household, activeUser: User) => {
    const bounds = getMonthBounds(monthStart);

    const [
      membersResult,
      categoriesResult,
      budgetMonthResult,
      expensesResult,
      recurringResult,
    ] = await Promise.all([
      supabase
        .from("household_members")
        .select("*,profiles(id,display_name,email,created_at,updated_at)")
        .eq("household_id", target.id)
        .order("joined_at", { ascending: true }),
      supabase.from("categories").select("*").eq("household_id", target.id).order("is_default", { ascending: false }),
      supabase
        .from("budget_months")
        .select("*")
        .eq("household_id", target.id)
        .eq("month_start", monthStart)
        .maybeSingle(),
      supabase
        .from("expenses")
        .select("*,categories(*),profiles(id,display_name,email,created_at,updated_at)")
        .eq("household_id", target.id)
        .gte("spent_on", bounds.start)
        .lte("spent_on", bounds.end)
        .order("spent_on", { ascending: false })
        .order("created_at", { ascending: false }),
      loadOptionalRecurringPayments(target.id),
    ]);

    if (membersResult.error) throw membersResult.error;
    if (categoriesResult.error) throw categoriesResult.error;
    if (budgetMonthResult.error) throw budgetMonthResult.error;
    if (expensesResult.error) throw expensesResult.error;

    const [budgetItemsResult, notificationsResult, commentsResult] = await Promise.all([
      loadBudgetItemsForHousehold(target.id),
      loadOptionalNotifications(target.id, activeUser.id),
      loadOptionalExpenseComments(target.id),
    ]);
    const warnings = [
      ...budgetItemsResult.warnings,
      recurringResult.warning,
      notificationsResult.warning,
      commentsResult.warning,
    ].filter((item): item is string => Boolean(item));

    const nextBudgetMonth = budgetMonthResult.data ? ({ ...budgetMonthResult.data } as BudgetMonth) : null;
    setMembers((membersResult.data ?? []).map(normalizeMember));
    setCategories((categoriesResult.data ?? []) as Category[]);
    setBudgetMonth(nextBudgetMonth);
    setBudgetItems(budgetItemsResult.data);
    setExpenses((expensesResult.data ?? []).map(normalizeExpense));
    const normalizedRecurring = recurringResult.data;
    setRecurringPayments(normalizedRecurring);
    setNotifications(notificationsResult.data);
    setExpenseComments(commentsResult.data);
    setDataWarnings(warnings);
    try {
      await ensureRecurringDueNotifications(target, normalizedRecurring, activeUser);
    } catch (caught) {
      if (isMissingRelation(caught)) {
        setDataWarnings((current) => [...current, "Recurring reminders are unavailable because notifications is not in this Supabase schema."]);
      } else {
        throw caught;
      }
    }

    if (!nextBudgetMonth) {
      setBudgetLimits([]);
      setAiInsight(null);
      return;
    }

    const [limitsResult, insightResult] = await Promise.all([
      supabase.from("budget_limits").select("*").eq("budget_month_id", nextBudgetMonth.id),
      loadOptionalAiInsight(nextBudgetMonth.id),
    ]);

    if (limitsResult.error) throw limitsResult.error;

    setBudgetLimits((limitsResult.data ?? []).map((limit: any) => ({ ...limit, amount: Number(limit.amount) })));
    setAiInsight(insightResult.data);
    if (insightResult.warning) {
      setDataWarnings((current) => [...current, insightResult.warning].filter((item, index, list) => list.indexOf(item) === index));
    }
  };

  const refresh = async (options: RefreshOptions = {}) => {
    if (authLoading) return;

    if (!user && !options.throwOnError) {
      clearHouseholdData();
      setError(null);
      setLoadIssue("none");
      return;
    }

    if (!hasSupabaseEnv) {
      const message = "Supabase environment variables are missing. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Netlify.";
      clearHouseholdData();
      setError(message);
      setLoadIssue("missing_env");
      if (options.throwOnError) throw new Error(message);
      return;
    }

    setLoading(true);
    setError(null);
    setLoadIssue("none");
    setDataWarnings([]);

    try {
      let activeUser = user ?? null;
      try {
        const refreshedSession = await refreshSession();
        activeUser = refreshedSession?.user ?? activeUser;
      } catch (sessionError) {
        if (options.throwOnError || !activeUser) throw sessionError;
        setDataWarnings((current) => [
          ...current,
          "Could not verify the Supabase session, so MoneyMates used the current logged-in user to load household data.",
        ]);
      }

      if (!activeUser) {
        const message = "Your login session could not be found. Sign in again to refresh household data.";
        clearHouseholdData();
        setError(message);
        setLoadIssue("load_failed");
        if (options.throwOnError) throw new Error(message);
        return;
      }

      const { data, error: membershipError } = await supabase
        .from("household_members")
        .select("household_id,role,joined_at,households(*)")
        .eq("user_id", activeUser.id)
        .order("joined_at", { ascending: true });

      if (membershipError) throw membershipError;
      const target = ((data as any[])?.[0]?.households ?? null) as Household | null;

      if (!target) {
        clearHouseholdData();
        setLoadIssue("no_household");
        return;
      }

      setHousehold(target);
      await loadHouseholdData(target, activeUser);
      setLoadIssue("none");
    } catch (caught) {
      const issue = classifyLoadIssue(caught);
      const message = errorMessage(caught) || "Could not load household.";
      setLoadIssue(issue);
      setError(message);
      if (options.throwOnError) throw caught instanceof Error ? caught : new Error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [authLoading, monthStart, user?.id]);

  useEffect(() => {
    if (!household || !user) return;
    const channel = supabase
      .channel(`household-stream-${household.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "expense_comments", filter: `household_id=eq.${household.id}` }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses", filter: `household_id=eq.${household.id}` }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "planned_budget_items", filter: `household_id=eq.${household.id}` }, () => void refresh())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [household?.id, user?.id]);

  const getOrCreateBudgetMonth = async () => {
    if (!household) throw new Error("Create or join a household first.");
    if (budgetMonth) return budgetMonth;

    const { data, error: insertError } = await supabase
      .from("budget_months")
      .insert({
        household_id: household.id,
        month_start: monthStart,
        total_income: 0,
        planned_budget: 0,
      })
      .select("*")
      .single();

    if (insertError) throw insertError;
    const created = data as BudgetMonth;
    setBudgetMonth(created);
    return created;
  };

  const setSelectedMonth = (nextMonthStart: string) => {
    setSelectedMonthState(nextMonthStart || getMonthStart());
  };

  const goToPreviousMonth = () => {
    setSelectedMonthState((current) => addMonthsToMonthStart(current, -1));
  };

  const goToNextMonth = () => {
    setSelectedMonthState((current) => addMonthsToMonthStart(current, 1));
  };

  const value = useMemo<HouseholdContextValue>(
    () => ({
      household,
      members,
      categories,
      budgetMonth,
      budgetLimits,
      budgetItems,
      expenses,
      recurringPayments,
      notifications,
      expenseComments,
      aiInsight,
      unreadNotificationCount: notifications.filter((item) => !item.read_at).length,
      monthStart,
      selectedMonth,
      loading,
      error,
      loadIssue,
      dataWarnings,
      isOwner,
      setSelectedMonth,
      goToPreviousMonth,
      goToNextMonth,
      refresh,
      createHousehold: async (name) => {
        if (!user) throw new Error("You need to be logged in.");
        const { data: existingMemberships, error: existingMembershipError } = await supabase
          .from("household_members")
          .select("household_id")
          .eq("user_id", user.id)
          .limit(1);
        if (existingMembershipError) throw existingMembershipError;
        if (existingMemberships?.length) {
          await refresh();
          throw new Error("This account already belongs to a household. I refreshed the existing household instead of creating a new one.");
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .upsert({ id: user.id, email: user.email ?? "", display_name: user.user_metadata.display_name ?? "" })
          .select("*")
          .single();

        if (profileError) throw profileError;
        if (!profile) throw new Error("Could not prepare your profile.");

        const { data: createdHousehold, error: householdError } = await supabase
          .from("households")
          .insert({
            name,
            owner_id: user.id,
            join_code: generateJoinCode(),
          })
          .select("*")
          .single();

        if (householdError) throw householdError;

        const target = createdHousehold as Household;
        const { error: memberError } = await supabase.from("household_members").insert({
          household_id: target.id,
          user_id: user.id,
          role: "owner",
        });
        if (memberError) throw memberError;

        const { error: categoryError } = await supabase.from("categories").insert(
          DEFAULT_CATEGORIES.map((category) => ({
            household_id: target.id,
            name: category.name,
            color: category.color,
            icon: category.icon,
            is_default: true,
          })),
        );
        if (categoryError) throw categoryError;

        const { error: budgetError } = await supabase.from("budget_months").insert({
          household_id: target.id,
          month_start: monthStart,
          total_income: 0,
          planned_budget: 0,
        });
        if (budgetError) throw budgetError;

        await refresh();
      },
      joinHousehold: async (joinCode) => {
        const { error: joinError } = await supabase.rpc("join_household_by_code", { p_join_code: joinCode });
        if (joinError) throw joinError;
        await refresh();
      },
      addExpense: async (input) => {
        if (!household || !user) throw new Error("You need a household before adding expenses.");
        const { error: expenseError } = await supabase.from("expenses").insert({
          household_id: household.id,
          user_id: user.id,
          category_id: input.category_id,
          amount: input.amount,
          spent_on: input.spent_on,
          merchant: input.merchant || null,
          note: input.note || null,
        });
        if (expenseError) throw expenseError;
        const categoryName = categories.find((category) => category.id === input.category_id)?.name ?? "Expense";
        const noteText = input.note?.trim() ? ` - Note: ${input.note.trim().slice(0, 140)}` : "";
        void sendHouseholdPhonePush({
          householdId: household.id,
          title: `${currentUserLabel()} added a new expense`,
          body: `${categoryName} - $${Number(input.amount).toFixed(2)}${noteText}`,
          url: "/",
        });
        await refresh();
      },
      saveBudget: async ({ totalIncome, plannedBudget, limits }) => {
        const targetMonth = await getOrCreateBudgetMonth();
        const { data: updatedMonth, error: monthError } = await supabase
          .from("budget_months")
          .update({
            total_income: totalIncome,
            planned_budget: plannedBudget,
          })
          .eq("id", targetMonth.id)
          .select("*")
          .single();
        if (monthError) throw monthError;

        const rows = limits.map((limit) => ({
          household_id: targetMonth.household_id,
          budget_month_id: targetMonth.id,
          category_id: limit.category_id,
          amount: limit.amount,
        }));

        if (rows.length) {
          const { error: limitError } = await supabase
            .from("budget_limits")
            .upsert(rows, { onConflict: "budget_month_id,category_id" });
          if (limitError) throw limitError;
        }

        setBudgetMonth(updatedMonth as BudgetMonth);
        await refresh();
      },
      saveBudgetItem: async (input, id) => {
        if (!household || !user) throw new Error("Create or join a household first.");
        const amount = input.amount === null || input.amount === undefined ? null : input.amount;
        const needsAmount = input.needs_amount || amount === null;
        const existingItem = id ? budgetItems.find((item) => item.id === id) : null;
        const scope = input.scope ?? input.item_scope ?? existingItem?.scope ?? existingItem?.item_scope ?? "personal";
        const budgetKind = input.budget_kind ?? existingItem?.budget_kind ?? (scope === "shared" ? "shared_expense" : defaultBudgetKind(input.type));
        const ownerUserId = input.owner_user_id || existingItem?.owner_user_id || existingItem?.created_by || user.id;
        const payerUserId = input.payer_user_id === undefined ? existingItem?.payer_user_id ?? ownerUserId : input.payer_user_id || null;
        const coreRow = {
          household_id: household.id,
          item_name: input.item_name,
          category: input.category,
          type: input.type,
          amount,
          frequency: input.frequency,
          quantity: input.quantity,
          start_date: input.start_date || null,
          notes: input.notes || null,
          needs_amount: needsAmount,
          is_active: input.is_active,
        };
        const compatibilityRow = {
          ...coreRow,
          item_scope: scope,
          budget_kind: budgetKind,
        };
        const row = {
          ...compatibilityRow,
          owner_user_id: ownerUserId,
          payer_user_id: payerUserId,
          scope,
        };

        const writeTables = uniqueTables([existingItem?.source_table, "planned_budget_items", "budget_items"]);
        let saved = false;
        let lastWriteError: unknown = null;

        for (const tableName of writeTables) {
          if (id) {
            let { data: updatedRow, error: updateError } = await supabase
              .from(tableName)
              .update(row)
              .eq("id", id)
              .eq("household_id", household.id)
              .select("id")
              .maybeSingle();

            if (updateError && isMissingColumn(updateError)) {
              const compatibilityFallback = await supabase
                .from(tableName)
                .update(compatibilityRow)
                .eq("id", id)
                .eq("household_id", household.id)
                .select("id")
                .maybeSingle();
              updatedRow = compatibilityFallback.data;
              updateError = compatibilityFallback.error;
            }

            if (updateError && isMissingColumn(updateError)) {
              const fallback = await supabase
                .from(tableName)
                .update(coreRow)
                .eq("id", id)
                .eq("household_id", household.id)
                .select("id")
                .maybeSingle();
              updatedRow = fallback.data;
              updateError = fallback.error;
            }

            if (updateError) {
              if (isMissingRelation(updateError)) {
                lastWriteError = updateError;
                continue;
              }
              throw updateError;
            }
            if (!updatedRow) continue;
            saved = true;
            break;
          }

          let { error: insertError } = await supabase.from(tableName).insert({ ...row, created_by: user.id }).select("id").single();
          if (insertError && isMissingColumn(insertError)) {
            const compatibilityFallback = await supabase.from(tableName).insert({ ...compatibilityRow, created_by: user.id }).select("id").single();
            insertError = compatibilityFallback.error;
          }
          if (insertError && isMissingColumn(insertError)) {
            const fallback = await supabase.from(tableName).insert({ ...coreRow, created_by: user.id }).select("id").single();
            insertError = fallback.error;
          }
          if (insertError) {
            if (isMissingRelation(insertError)) {
              lastWriteError = insertError;
              continue;
            }
            throw insertError;
          }
          saved = true;
          break;
        }

        if (!saved) {
          throw new Error(errorMessage(lastWriteError) || "Could not save budget item because no budget item table is available.");
        }

        void sendHouseholdPhonePush({
          householdId: household.id,
          title: `${currentUserLabel()} ${id ? "updated" : "added"} a budget item`,
          body: `${input.item_name} - ${needsAmount ? "Needs amount" : `$${Number(amount).toFixed(2)}`}`,
          url: "/budget",
        });
        await refresh();
      },
      archiveBudgetItem: async (id) => {
        if (!household) throw new Error("Create or join a household first.");
        const archivedItem = budgetItems.find((item) => item.id === id);
        const writeTables = uniqueTables([archivedItem?.source_table, "planned_budget_items", "budget_items"]);
        let archived = false;
        let lastArchiveError: unknown = null;

        for (const tableName of writeTables) {
          const archiveRow = { is_active: false, archived_at: new Date().toISOString() };
          let { data: updatedRow, error: archiveError } = await supabase
            .from(tableName)
            .update(archiveRow)
            .eq("id", id)
            .eq("household_id", household.id)
            .select("id")
            .maybeSingle();

          if (archiveError && isMissingColumn(archiveError)) {
            const fallback = await supabase
              .from(tableName)
              .update({ is_active: false })
              .eq("id", id)
              .eq("household_id", household.id)
              .select("id")
              .maybeSingle();
            updatedRow = fallback.data;
            archiveError = fallback.error;
          }

          if (archiveError) {
            if (isMissingRelation(archiveError)) {
              lastArchiveError = archiveError;
              continue;
            }
            throw archiveError;
          }
          if (!updatedRow) continue;
          archived = true;
          break;
        }

        if (!archived) {
          throw new Error(errorMessage(lastArchiveError) || "Could not archive budget item because it was not found.");
        }

        void sendHouseholdPhonePush({
          householdId: household.id,
          title: `${currentUserLabel()} archived a budget item`,
          body: archivedItem?.item_name ?? "Budget item archived",
          url: "/budget",
        });
        await refresh();
      },
      completeBudgetSetup: async () => {
        if (!household || !user) throw new Error("Create or join a household first.");
        const completedAt = new Date().toISOString();
        const { error: setupError } = await supabase.rpc("complete_household_budget_setup", { p_household_id: household.id });
        if (setupError) {
          if (isMissingColumn(setupError) || isMissingFunction(setupError)) {
            await refresh();
            return;
          }
          throw setupError;
        }
        setMembers((current) =>
          current.map((member) => (member.household_id === household.id && member.user_id === user.id ? { ...member, budget_setup_completed_at: completedAt } : member)),
        );
        await refresh();
      },
      createCategory: async (name) => {
        if (!household) throw new Error("Create a household first.");
        const { error: categoryError } = await supabase.from("categories").insert({
          household_id: household.id,
          name,
          color: "#2f6b57",
          icon: "wallet",
          is_default: false,
        });
        if (categoryError) throw categoryError;
        await refresh();
      },
      saveRecurringPayment: async (input) => {
        if (!household || !user) throw new Error("Create a household first.");
        const { error: recurringError } = await supabase.from("recurring_payments").insert({
          household_id: household.id,
          category_id: input.categoryId,
          name: input.name,
          amount: input.amount,
          due_day: input.dueDay,
          cadence: "monthly",
          created_by: user.id,
        });
        if (recurringError) throw recurringError;
        await refresh();
      },
      deleteRecurringPayment: async (id) => {
        const { error: deleteError } = await supabase.from("recurring_payments").delete().eq("id", id);
        if (deleteError) throw deleteError;
        await refresh();
      },
      saveAiInsight: async (response) => {
        if (!household || !user) throw new Error("Create a household first.");
        const targetMonth = await getOrCreateBudgetMonth();
        const { error: insightError } = await supabase.from("ai_insights").insert({
          household_id: household.id,
          budget_month_id: targetMonth.id,
          summary: response.summary,
          suggestions: [
            ...response.suggestions,
            response.savingsIdea,
            response.needsVsWants,
            response.safeSpendingSuggestion,
            response.disclaimer,
          ].filter(Boolean),
          warning: response.warning || response.disclaimer,
          today_action: response.todayAction,
          created_by: user.id,
        });
        if (insightError) throw insightError;
        await refresh();
      },
      markNotificationRead: async (id) => {
        if (!user) throw new Error("You need to be logged in.");
        const readAt = new Date().toISOString();
        const { error: updateError } = await supabase.from("notifications").update({ read_at: readAt }).eq("id", id).eq("user_id", user.id);
        if (updateError) throw updateError;
        setNotifications((current) => current.map((item) => (item.id === id ? { ...item, read_at: readAt } : item)));
      },
      markAllNotificationsRead: async () => {
        if (!user) throw new Error("You need to be logged in.");
        const readAt = new Date().toISOString();
        const { error: updateError } = await supabase.from("notifications").update({ read_at: readAt }).eq("user_id", user.id).is("read_at", null);
        if (updateError) throw updateError;
        setNotifications((current) => current.map((item) => (item.read_at ? item : { ...item, read_at: readAt })));
      },
      addExpenseComment: async (expenseId, body) => {
        if (!household || !user) throw new Error("Create a household first.");
        const { error: commentError } = await supabase.from("expense_comments").insert({ household_id: household.id, expense_id: expenseId, user_id: user.id, body });
        if (commentError) throw commentError;
      },
    }),
    [
      household,
      members,
      categories,
      budgetMonth,
      budgetLimits,
      budgetItems,
      expenses,
      recurringPayments,
      notifications,
      expenseComments,
      aiInsight,
      monthStart,
      selectedMonth,
      loading,
      error,
      loadIssue,
      dataWarnings,
      isOwner,
      authLoading,
      user,
      refreshSession,
    ],
  );

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

export function useHousehold() {
  const context = useContext(HouseholdContext);
  if (!context) {
    throw new Error("useHousehold must be used inside HouseholdProvider");
  }
  return context;
}
