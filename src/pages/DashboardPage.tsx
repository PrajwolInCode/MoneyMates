import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AreaChart, BarChart3, CalendarDays, CircleDollarSign, Landmark, PieChart as PieChartIcon, Plus, Wallet } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { CategoryProgressList } from "../components/CategoryProgressList";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { RecurringList } from "../components/RecurringList";
import { StatCard } from "../components/StatCard";
import { TransactionsList } from "../components/TransactionsList";
import { WarningBanner } from "../components/WarningBanner";
import { useHousehold } from "../contexts/HouseholdContext";
import {
  biggestCategory,
  buildCoachPayload,
  dailyTrend,
  plannedVsActual,
  spendingByCategory,
  spendingByPerson,
  totalBudget,
  totalSpent,
} from "../lib/budget";
import { requestBudgetCoach } from "../lib/coach";
import { daysLeftInMonth, formatMonthLabel } from "../lib/date";
import { compactCurrency, currency } from "../lib/format";

export function DashboardPage() {
  const {
    household,
    members,
    categories,
    budgetMonth,
    budgetLimits,
    expenses,
    recurringPayments,
    aiInsight,
    notifications,
    monthStart,
    saveAiInsight,
  } = useHousehold();
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);

  const monthLabel = formatMonthLabel(monthStart);
  const spent = totalSpent(expenses);
  const planned = totalBudget(budgetMonth, budgetLimits);
  const remaining = planned - spent;
  const daysLeft = daysLeftInMonth(monthStart);
  const safeDailySpend = Math.max(0, remaining) / daysLeft;
  const biggest = biggestCategory(expenses, categories, budgetLimits);
  const people = spendingByPerson(expenses, members);
  const primaryPerson = people[0] ?? { id: "praj", name: "Praj", spent: 0 };
  const secondaryPerson = people[1] ?? { id: "wife", name: "Wife", spent: 0 };

  const categoryRows = useMemo(() => spendingByCategory(expenses, categories, budgetLimits), [expenses, categories, budgetLimits]);
  const plannedRows = useMemo(() => plannedVsActual(expenses, categories, budgetLimits).slice(0, 8), [expenses, categories, budgetLimits]);
  const trendRows = useMemo(() => dailyTrend(expenses), [expenses]);

  const handleCoach = async () => {
    if (!household) return;
    setCoachError(null);
    setCoachLoading(true);
    try {
      const payload = buildCoachPayload({
        household,
        monthStart,
        budgetMonth,
        categories,
        limits: budgetLimits,
        expenses,
        members,
        recurringPayments,
      });
      const response = await requestBudgetCoach(payload);
      await saveAiInsight(response);
    } catch (caught) {
      setCoachError(caught instanceof Error ? caught.message : "The budget coach could not respond.");
    } finally {
      setCoachLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow={monthLabel}
        title="Household dashboard"
        description="A simple daily view of what has been spent, what remains, and where a small adjustment would help."
        action={
          <Link
            to="/add"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white shadow-soft hover:bg-ink sm:w-auto"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add expense
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title={`${monthLabel} total spent`} value={currency(spent)} detail="Combined spending from both of you." icon={CircleDollarSign} />
        <StatCard
          title="Remaining budget"
          value={currency(remaining)}
          detail={planned > 0 ? `${currency(planned)} planned for this month.` : "Set a monthly plan to unlock remaining budget."}
          icon={Wallet}
          tone={remaining < 0 ? "danger" : "good"}
        />
        <StatCard
          title="Safe daily spend"
          value={currency(safeDailySpend)}
          detail={`${daysLeft} day${daysLeft === 1 ? "" : "s"} left in the month.`}
          icon={CalendarDays}
          tone="good"
        />
        <StatCard
          title="Biggest category"
          value={biggest ? compactCurrency(biggest.spent) : "$0"}
          detail={biggest ? biggest.category : "No category has spending yet."}
          icon={Landmark}
        />
        <StatCard title={`Spending by ${primaryPerson.name}`} value={currency(primaryPerson.spent)} icon={AreaChart} />
        <StatCard title={`Spending by ${secondaryPerson.name}`} value={currency(secondaryPerson.spent)} icon={AreaChart} />
        <Card className="sm:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-moss">AI budget coach</p>
              <h2 className="mt-1 text-xl font-bold tracking-normal text-ink">{aiInsight?.summary ?? "Ready for a calm check-in"}</h2>
            </div>
            <Button onClick={handleCoach} loading={coachLoading} variant="secondary">
              Ask coach
            </Button>
          </div>
          {aiInsight ? (
            <div className="mt-4 space-y-3 text-sm leading-6 text-ink/70">
              <p>{aiInsight.today_action}</p>
              {aiInsight.warning ? <WarningBanner>{aiInsight.warning}</WarningBanner> : null}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-ink/65">The coach only receives summarized monthly budget data, not raw account access.</p>
          )}
          {coachError ? (
            <div className="mt-3">
              <WarningBanner tone="strong">{coachError}</WarningBanner>
            </div>
          ) : null}
        </Card>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-normal text-ink">Spending by category</h2>
            <PieChartIcon className="h-5 w-5 text-moss" aria-hidden="true" />
          </div>
          {categoryRows.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryRows} dataKey="spent" nameKey="category" innerRadius={54} outerRadius={92} paddingAngle={2}>
                    {categoryRows.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => currency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="No chart data yet" message="Add an expense to see where money is going." />
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-normal text-ink">Planned vs actual</h2>
            <BarChart3 className="h-5 w-5 text-moss" aria-hidden="true" />
          </div>
          {plannedRows.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={plannedRows}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="category" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis tickFormatter={(value) => compactCurrency(Number(value))} />
                  <Tooltip formatter={(value) => currency(Number(value))} />
                  <Legend />
                  <Bar dataKey="Planned" fill="#dcebe2" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Actual" fill="#2f6b57" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="No plan yet" message="Set category limits to compare planned and actual spending." />
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <h2 className="text-xl font-bold tracking-normal text-ink">Daily spending trend</h2>
          {trendRows.length ? (
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendRows}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" />
                  <YAxis tickFormatter={(value) => compactCurrency(Number(value))} />
                  <Tooltip formatter={(value) => currency(Number(value))} />
                  <Line type="monotone" dataKey="amount" stroke="#0f3d3e" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState title="No trend yet" message="Daily spending appears once expenses are saved." />
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-xl font-bold tracking-normal text-ink">Upcoming recurring payments</h2>
          <div className="mt-2">
            <RecurringList payments={recurringPayments.slice(0, 5)} />
          </div>
        </Card>
      </div>


      <div className="mt-5">
        <Card>
          <h2 className="text-xl font-bold tracking-normal text-ink">Real-time activity feed</h2>
          <div className="mt-3 space-y-2">
            {notifications.slice(0, 8).map((item) => (
              <div key={item.id} className="rounded-xl border border-sage/70 bg-mist px-3 py-2">
                <p className="text-sm font-semibold text-ink">{item.title}</p>
                <p className="text-xs text-ink/70">{item.body}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <h2 className="text-xl font-bold tracking-normal text-ink">Recent transactions</h2>
          <div className="mt-2">
            <TransactionsList expenses={expenses} limit={6} />
          </div>
        </Card>
        <Card>
          <h2 className="text-xl font-bold tracking-normal text-ink">Category progress</h2>
          <div className="mt-4">
            <CategoryProgressList expenses={expenses} categories={categories} limits={budgetLimits} />
          </div>
        </Card>
      </div>
    </div>
  );
}
