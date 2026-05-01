import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Sheet } from "lucide-react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { inputClass } from "../components/inputs";
import { PageHeader } from "../components/PageHeader";
import { TransactionsList } from "../components/TransactionsList";
import { WarningBanner } from "../components/WarningBanner";
import { useHousehold } from "../contexts/HouseholdContext";
import { spendingByCategory, spendingByPerson, totalBudget, totalSpent } from "../lib/budget";
import { BUDGET_START_MONTH } from "../lib/constants";
import { formatMonthLabel, getMonthBounds, monthInputToStart, monthStartToInput } from "../lib/date";
import { exportSummaryPdf, exportTransactionsCsv, exportTransactionsExcel } from "../lib/export";
import { currency } from "../lib/format";
import { supabase } from "../lib/supabase";
import type { AiInsight, BudgetLimit, BudgetMonth, Expense } from "../types";

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

export function ReportsPage() {
  const { household, categories, members, monthStart } = useHousehold();
  const [selectedMonth, setSelectedMonth] = useState(monthStartToInput(monthStart));
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgetMonth, setBudgetMonth] = useState<BudgetMonth | null>(null);
  const [limits, setLimits] = useState<BudgetLimit[]>([]);
  const [aiInsight, setAiInsight] = useState<AiInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedStart = monthInputToStart(selectedMonth);
  const monthLabel = formatMonthLabel(selectedStart);
  const spent = useMemo(() => totalSpent(expenses), [expenses]);
  const planned = useMemo(() => totalBudget(budgetMonth, limits), [budgetMonth, limits]);
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
        const [expenseResult, monthResult] = await Promise.all([
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
        ]);

        if (expenseResult.error) throw expenseResult.error;
        if (monthResult.error) throw monthResult.error;
        if (!mounted) return;

        const nextBudgetMonth = monthResult.data ? ({ ...monthResult.data } as BudgetMonth) : null;
        setExpenses((expenseResult.data ?? []).map(normalizeExpense));
        setBudgetMonth(nextBudgetMonth);

        if (!nextBudgetMonth) {
          setLimits([]);
          setAiInsight(null);
          return;
        }

        const [limitResult, insightResult] = await Promise.all([
          supabase.from("budget_limits").select("*").eq("budget_month_id", nextBudgetMonth.id),
          supabase
            .from("ai_insights")
            .select("*")
            .eq("budget_month_id", nextBudgetMonth.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (limitResult.error) throw limitResult.error;
        if (insightResult.error) throw insightResult.error;
        if (!mounted) return;

        setLimits((limitResult.data ?? []).map((limit: any) => ({ ...limit, amount: Number(limit.amount) })));
        setAiInsight(insightResult.data ? normalizeInsight(insightResult.data) : null);
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

  const filenameBase = `${household?.name ?? "moneymates"}-${selectedMonth}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-");

  return (
    <div>
      <PageHeader
        eyebrow="Exports"
        title="Reports"
        description="Choose a month, then export transactions or a summary you can keep with household records."
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
              min={monthStartToInput(BUDGET_START_MONTH)}
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
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
          <p className="mt-2 text-2xl font-bold tracking-normal text-ink">{currency(Number(budgetMonth?.total_income ?? 0))}</p>
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
              <EmptyState title="No spending split" message="Invite your spouse and add expenses to show this split." />
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-5">
        <h2 className="text-xl font-bold tracking-normal text-ink">Transactions</h2>
        <div className="mt-2">
          <TransactionsList expenses={expenses} />
        </div>
      </Card>
    </div>
  );
}
