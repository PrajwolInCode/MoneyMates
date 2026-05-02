import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Sheet } from "lucide-react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { inputClass } from "../components/inputs";
import { MonthSelector } from "../components/MonthSelector";
import { PageHeader } from "../components/PageHeader";
import { TransactionsList } from "../components/TransactionsList";
import { WarningBanner } from "../components/WarningBanner";
import { useHousehold } from "../contexts/HouseholdContext";
import { spendingByCategory, spendingByPerson, totalBudget, totalBudgetItemMonthlyIncome, totalBudgetItemMonthlyPlannedExpenses, totalSpent } from "../lib/budget";
import { formatMonthLabel, getMonthBounds, monthInputToStart, monthStartToInput } from "../lib/date";
import { exportSummaryPdf, exportTransactionsCsv, exportTransactionsExcel } from "../lib/export";
import { currency } from "../lib/format";
import { supabase } from "../lib/supabase";
import type { AiInsight, BudgetItem, BudgetLimit, BudgetMonth, Expense } from "../types";

function normalizeExpense(row: any): Expense {
  return {
    ...row,
    amount: Number(row.amount),
    category: row.categories ?? null,
    profile: row.profiles ?? null,
  };
}

function normalizeInsight(row: any): AiInsight {
  return {
    ...row,
    suggestions: Array.isArray(row.suggestions) ? row.suggestions : [],
  };
}

function normalizeBudgetItem(row: any, sourceTable?: BudgetItem["source_table"]): BudgetItem {
  const amount = row.amount === null || row.amount === undefined ? null : Number(row.amount);
  return {
    ...row,
    item_name: row.item_name ?? row.name ?? "Budget item",
    category: row.category ?? "Other",
    type: row.type ?? row.item_type ?? "variable",
    amount,
    frequency: row.frequency ?? "monthly",
    quantity: Number(row.quantity ?? 1),
    start_date: row.start_date ?? row.starts_on ?? null,
    needs_amount: row.needs_amount === null || row.needs_amount === undefined ? amount === null : Boolean(row.needs_amount),
    is_active: row.is_active === null || row.is_active === undefined ? true : Boolean(row.is_active),
    archived_at: row.archived_at ?? null,
    source_table: sourceTable,
  };
}

function isMissingRelation(caught: unknown) {
  const message = caught instanceof Error ? caught.message.toLowerCase() : "";
  const code = typeof caught === "object" && caught && "code" in caught ? String((caught as { code?: unknown }).code ?? "").toLowerCase() : "";
  return message.includes("could not find the table") || code === "42p01" || code === "pgrst205";
}

function isMissingColumn(caught: unknown) {
  const message = caught instanceof Error ? caught.message.toLowerCase() : "";
  const code = typeof caught === "object" && caught && "code" in caught ? String((caught as { code?: unknown }).code ?? "").toLowerCase() : "";
  return (
    code === "42703" ||
    code === "pgrst204" ||
    (message.includes("column") && (message.includes("does not exist") || message.includes("schema cache") || message.includes("could not find")))
  );
}

async function loadReportBudgetItems(householdId: string) {
  const loadedById = new Map<string, BudgetItem>();
  const tableNames: Array<NonNullable<BudgetItem["source_table"]>> = ["planned_budget_items", "budget_items"];

  for (const tableName of tableNames) {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .eq("household_id", householdId);

    if (error) {
      if (isMissingRelation(error) || isMissingColumn(error)) continue;
      throw error;
    }

    (data ?? [])
      .map((row: any) => normalizeBudgetItem(row, tableName))
      .filter((item) => !item.archived_at)
      .forEach((item) => loadedById.set(item.id, item));
  }

  return Array.from(loadedById.values());
}

async function loadReportAiInsight(budgetMonthId: string) {
  const { data, error } = await supabase
    .from("ai_insights")
    .select("*")
    .eq("budget_month_id", budgetMonthId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingRelation(error)) return null;
    throw error;
  }

  return data ? normalizeInsight(data) : null;
}

export function ReportsPage() {
  const { household, categories, members, monthStart, setSelectedMonth } = useHousehold();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgetMonth, setBudgetMonth] = useState<BudgetMonth | null>(null);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [limits, setLimits] = useState<BudgetLimit[]>([]);
  const [aiInsight, setAiInsight] = useState<AiInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedStart = monthStart;
  const selectedMonthInput = monthStartToInput(monthStart);
  const monthLabel = formatMonthLabel(selectedStart);
  const spent = useMemo(() => totalSpent(expenses), [expenses]);
  const manualPlanned = useMemo(() => totalBudgetItemMonthlyPlannedExpenses(budgetItems), [budgetItems]);
  const manualIncome = useMemo(() => totalBudgetItemMonthlyIncome(budgetItems), [budgetItems]);
  const planned = useMemo(() => (manualPlanned > 0 ? manualPlanned : totalBudget(budgetMonth, limits)), [budgetMonth, limits, manualPlanned]);
  const totalIncome = manualIncome > 0 ? manualIncome : Number(budgetMonth?.total_income ?? 0);
  const categoryRows = useMemo(() => spendingByCategory(expenses, categories, limits), [expenses, categories, limits]);
  const peopleRows = useMemo(() => spendingByPerson(expenses, members), [expenses, members]);

  useEffect(() => {
    const activeHousehold = household;
    if (!activeHousehold) return;
    const householdId = activeHousehold.id;
    let mounted = true;

    async function loadReport() {
      setLoading(true);
      setError(null);
      const bounds = getMonthBounds(selectedStart);

      try {
        const [expenseResult, monthResult, nextBudgetItems] = await Promise.all([
          supabase
            .from("expenses")
            .select("*,categories(*),profiles(id,display_name,email,created_at,updated_at)")
            .eq("household_id", householdId)
            .gte("spent_on", bounds.start)
            .lte("spent_on", bounds.end)
            .order("spent_on", { ascending: false }),
          supabase
            .from("budget_months")
            .select("*")
            .eq("household_id", householdId)
            .eq("month_start", selectedStart)
            .maybeSingle(),
          loadReportBudgetItems(householdId),
        ]);

        if (expenseResult.error) throw expenseResult.error;
        if (monthResult.error) throw monthResult.error;
        if (!mounted) return;

        const nextBudgetMonth = monthResult.data ? ({ ...monthResult.data } as BudgetMonth) : null;
        setExpenses((expenseResult.data ?? []).map(normalizeExpense));
        setBudgetMonth(nextBudgetMonth);
        setBudgetItems(nextBudgetItems);

        if (!nextBudgetMonth) {
          setLimits([]);
          setAiInsight(null);
          return;
        }

        const [limitResult, insightResult] = await Promise.all([
          supabase.from("budget_limits").select("*").eq("budget_month_id", nextBudgetMonth.id),
          loadReportAiInsight(nextBudgetMonth.id),
        ]);

        if (limitResult.error) throw limitResult.error;
        if (!mounted) return;

        setLimits((limitResult.data ?? []).map((limit: any) => ({ ...limit, amount: Number(limit.amount) })));
        setAiInsight(insightResult);
      } catch (caught) {
        if (mounted) setError(caught instanceof Error ? caught.message : "Could not load report.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadReport();
    return () => {
      mounted = false;
    };
  }, [household, selectedStart]);

  const filenameBase = `${household?.name ?? "moneymates"}-${selectedMonthInput}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-");

  return (
    <div>
      <PageHeader
        eyebrow="Exports"
        title="Reports"
        description="Choose a month, then export transactions or a summary you can keep with household records."
        action={<MonthSelector />}
      />

      {error ? (
        <div className="mb-4">
          <WarningBanner tone="strong">{error}</WarningBanner>
        </div>
      ) : null}

      <Card>
        <div className="grid gap-4 md:grid-cols-[220px_1fr] md:items-end">
          <label>
            <span className="mb-1.5 block text-sm font-semibold text-ink">Month</span>
            <input
              className={inputClass}
              type="month"
              value={selectedMonthInput}
              onChange={(event) => setSelectedMonth(monthInputToStart(event.target.value))}
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" disabled={!expenses.length || loading} onClick={() => exportTransactionsCsv(`${filenameBase}-transactions.csv`, expenses)}>
              <Download className="h-4 w-4" aria-hidden="true" />
              CSV
            </Button>
            <Button
              variant="secondary"
              disabled={!expenses.length || loading}
              onClick={() => void exportTransactionsExcel(`${filenameBase}-transactions.xlsx`, expenses)}
            >
              <Sheet className="h-4 w-4" aria-hidden="true" />
              Excel
            </Button>
            <Button
              disabled={loading}
              onClick={() =>
                household &&
                void exportSummaryPdf({
                    filename: `${filenameBase}-summary.pdf`,
                    household,
                    monthLabel,
                    budgetMonth,
                    categories,
                    limits,
                    budgetItems,
                    expenses,
                    members,
                    aiInsight,
                  })
              }
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              PDF summary
            </Button>
          </div>
        </div>
      </Card>

      <div className="mt-5 grid gap-4 lg:grid-cols-4">
        <Card>
          <p className="text-sm font-medium text-ink/60">Month</p>
          <p className="mt-2 text-2xl font-bold tracking-normal text-ink">{monthLabel}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-ink/60">Total income</p>
          <p className="mt-2 text-2xl font-bold tracking-normal text-ink">{currency(totalIncome)}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-ink/60">Total spent</p>
          <p className="mt-2 text-2xl font-bold tracking-normal text-ink">{currency(spent)}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-ink/60">Remaining budget</p>
          <p className="mt-2 text-2xl font-bold tracking-normal text-ink">{currency(planned - spent)}</p>
        </Card>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <h2 className="text-xl font-bold tracking-normal text-ink">Spending by category</h2>
          {categoryRows.length ? (
            <div className="mt-4 space-y-3">
              {categoryRows.map((row) => (
                <div key={row.id} className="flex items-center justify-between rounded-2xl bg-sage/45 p-4">
                  <span className="font-semibold text-ink">{row.category}</span>
                  <span className="font-bold text-ink">{currency(row.spent)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState title="No category spending" message="This month has no recorded category spending yet." />
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-xl font-bold tracking-normal text-ink">Spending by person</h2>
          {peopleRows.length ? (
            <div className="mt-4 space-y-3">
              {peopleRows.map((person) => (
                <div key={person.id} className="flex items-center justify-between rounded-2xl bg-sage/45 p-4">
                  <span className="font-semibold text-ink">{person.name}</span>
                  <span className="font-bold text-ink">{currency(person.spent)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState title="No spending split" message="Invite household members and add expenses to show this split." />
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-5">
        <h2 className="text-xl font-bold tracking-normal text-ink">Transactions</h2>
        <div className="mt-2">
          <TransactionsList
            expenses={expenses}
            emptyTitle="No expenses for this month yet"
            emptyMessage="Use the month selector to review another month, or add an expense for this one."
          />
        </div>
      </Card>
    </div>
  );
}
