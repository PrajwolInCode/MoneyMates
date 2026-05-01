import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_CATEGORIES } from "../lib/constants";
import { getMonthBounds, getMonthStart } from "../lib/date";
import { supabase } from "../lib/supabase";
import type {
  AiInsight,
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

type HouseholdContextValue = {
  household: Household | null;
  members: HouseholdMember[];
  categories: Category[];
  budgetMonth: BudgetMonth | null;
  budgetLimits: BudgetLimit[];
  expenses: Expense[];
  recurringPayments: RecurringPayment[];
  notifications: Notification[];
  expenseComments: ExpenseComment[];
  unreadNotificationCount: number;
  aiInsight: AiInsight | null;
  monthStart: string;
  loading: boolean;
  error: string | null;
  isOwner: boolean;
  refresh: () => Promise<void>;
  createHousehold: (name: string) => Promise<void>;
  joinHousehold: (joinCode: string) => Promise<void>;
  addExpense: (input: AddExpenseInput) => Promise<void>;
  saveBudget: (input: { totalIncome: number; plannedBudget: number; limits: BudgetLimitInput[] }) => Promise<void>;
  createCategory: (name: string) => Promise<void>;
  saveRecurringPayment: (input: { name: string; amount: number; dueDay: number; categoryId: string }) => Promise<void>;
  deleteRecurringPayment: (id: string) => Promise<void>;
  saveAiInsight: (response: CoachResponse) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
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

function normalizeInsight(row: any): AiInsight {
  return {
    ...row,
    suggestions: Array.isArray(row.suggestions) ? row.suggestions : [],
  };
}

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgetMonth, setBudgetMonth] = useState<BudgetMonth | null>(null);
  const [budgetLimits, setBudgetLimits] = useState<BudgetLimit[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);
  const [aiInsight, setAiInsight] = useState<AiInsight | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [expenseComments, setExpenseComments] = useState<ExpenseComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const monthStart = getMonthStart();

  const isOwner = Boolean(household && user && household.owner_id === user.id);

  const clearHouseholdData = () => {
    setHousehold(null);
    setMembers([]);
    setCategories([]);
    setBudgetMonth(null);
    setBudgetLimits([]);
    setExpenses([]);
    setRecurringPayments([]);
    setAiInsight(null);
    setNotifications([]);
    setExpenseComments([]);
  };

  const loadHouseholdData = async (target: Household) => {
    const bounds = getMonthBounds(monthStart);

    const [membersResult, categoriesResult, budgetMonthResult, expensesResult, recurringResult, notificationsResult, commentsResult] = await Promise.all([
      supabase
        .from("household_members")
        .select("household_id,user_id,role,joined_at,profiles(id,display_name,email,created_at,updated_at)")
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
      supabase
        .from("recurring_payments")
        .select("*,categories(*)")
        .eq("household_id", target.id)
        .order("due_day", { ascending: true }),
      supabase.from("notifications").select("*").eq("household_id", target.id).order("created_at", { ascending: false }).limit(40),
      supabase
        .from("expense_comments")
        .select("*,profiles(id,display_name,email,created_at,updated_at)")
        .eq("household_id", target.id)
        .order("created_at", { ascending: true }),
    ]);

    if (membersResult.error) throw membersResult.error;
    if (categoriesResult.error) throw categoriesResult.error;
    if (budgetMonthResult.error) throw budgetMonthResult.error;
    if (expensesResult.error) throw expensesResult.error;
    if (recurringResult.error) throw recurringResult.error;
    if (notificationsResult.error) throw notificationsResult.error;
    if (commentsResult.error) throw commentsResult.error;

    const nextBudgetMonth = budgetMonthResult.data ? ({ ...budgetMonthResult.data } as BudgetMonth) : null;
    setMembers((membersResult.data ?? []).map(normalizeMember));
    setCategories((categoriesResult.data ?? []) as Category[]);
    setBudgetMonth(nextBudgetMonth);
    setExpenses((expensesResult.data ?? []).map(normalizeExpense));
    setRecurringPayments((recurringResult.data ?? []).map(normalizeRecurring));
    setNotifications((notificationsResult.data ?? []) as Notification[]);
    setExpenseComments((commentsResult.data ?? []).map((row: any) => ({ ...row, profile: row.profiles ?? null })));

    if (!nextBudgetMonth) {
      setBudgetLimits([]);
      setAiInsight(null);
      return;
    }

    const [limitsResult, insightResult] = await Promise.all([
      supabase.from("budget_limits").select("*").eq("budget_month_id", nextBudgetMonth.id),
      supabase
        .from("ai_insights")
        .select("*")
        .eq("budget_month_id", nextBudgetMonth.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (limitsResult.error) throw limitsResult.error;
    if (insightResult.error) throw insightResult.error;

    setBudgetLimits((limitsResult.data ?? []).map((limit: any) => ({ ...limit, amount: Number(limit.amount) })));
    setAiInsight(insightResult.data ? normalizeInsight(insightResult.data) : null);
  };

  const refresh = async () => {
    if (!user) {
      clearHouseholdData();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: membershipError } = await supabase
        .from("household_members")
        .select("role,households(*)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (membershipError) throw membershipError;
      const target = (data as any)?.households as Household | undefined;

      if (!target) {
        clearHouseholdData();
        return;
      }

      setHousehold(target);
      await loadHouseholdData(target);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not load household.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [user?.id]);

  useEffect(() => {
    if (!household || !user) return;
    const channel = supabase
      .channel(`household-stream-${household.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `household_id=eq.${household.id}` }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "expense_comments", filter: `household_id=eq.${household.id}` }, () => void refresh())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "expenses", filter: `household_id=eq.${household.id}` }, () => void refresh())
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

  const value = useMemo<HouseholdContextValue>(
    () => ({
      household,
      members,
      categories,
      budgetMonth,
      budgetLimits,
      expenses,
      recurringPayments,
      notifications,
      expenseComments,
      aiInsight,
      unreadNotificationCount: notifications.filter((item) => !item.read_at).length,
      monthStart,
      loading,
      error,
      isOwner,
      refresh,
      createHousehold: async (name) => {
        if (!user) throw new Error("You need to be logged in.");

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
          suggestions: response.suggestions,
          warning: response.warning,
          today_action: response.todayAction,
          created_by: user.id,
        });
        if (insightError) throw insightError;
        await refresh();
      },
      markNotificationRead: async (id) => {
        const { error: updateError } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
        if (updateError) throw updateError;
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
      expenses,
      recurringPayments,
      notifications,
      expenseComments,
      aiInsight,
      monthStart,
      loading,
      error,
      isOwner,
      user,
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
