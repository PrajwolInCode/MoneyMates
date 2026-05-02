import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { WarningBanner } from "../components/WarningBanner";
import { useHousehold } from "../contexts/HouseholdContext";
import { buildCoachPayload, dailyTrend, plannedVsActual, spendingByCategory, spendingByPerson } from "../lib/budget";
import { requestBudgetCoach } from "../lib/coach";
import { formatMonthLabel } from "../lib/date";
import { compactCurrency, currency } from "../lib/format";

export function InsightsPage() {
  const {
    household,
    monthStart,
    budgetMonth,
    budgetLimits,
    budgetItems,
    categories,
    expenses,
    members,
    recurringPayments,
    aiInsight,
    saveAiInsight,
  } = useHousehold();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryRows = useMemo(() => spendingByCategory(expenses, categories, budgetLimits), [expenses, categories, budgetLimits]);
  const plannedRows = useMemo(() => plannedVsActual(expenses, categories, budgetLimits), [expenses, categories, budgetLimits]);
  const trendRows = useMemo(() => dailyTrend(expenses), [expenses]);
  const peopleRows = useMemo(() => spendingByPerson(expenses, members), [expenses, members]);

  const handleCoach = async () => {
    if (!household) return;
    setLoading(true);
    setError(null);
    try {
      const payload = buildCoachPayload({
        household,
        monthStart,
        budgetMonth,
        limits: budgetLimits,
        categories,
        expenses,
        members,
        recurringPayments,
        budgetItems,
      });
      const response = await requestBudgetCoach(payload);
      await saveAiInsight(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load coach insight.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow={formatMonthLabel(monthStart)}
        title="Insights"
        description="Use this page for the calmer patterns: category pressure, daily rhythm, person split, and coaching."
        action={
          <Button onClick={handleCoach} loading={loading}>
            Ask coach
          </Button>
        }
      />

      {error ? (
        <div className="mb-4">
          <WarningBanner tone="strong">{error}</WarningBanner>
        </div>
      ) : null}

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-moss">AI budget coach</p>
            <h2 className="mt-1 text-2xl font-bold tracking-normal text-ink">{aiInsight?.summary ?? "No coaching summary yet"}</h2>
            <p className="mt-2 text-sm leading-6 text-ink/65">
              Advice is based on monthly totals, category limits, fixed payments, and days left in the month.
            </p>
          </div>
          {aiInsight?.warning ? <WarningBanner>{aiInsight.warning}</WarningBanner> : null}
        </div>
        {aiInsight ? (
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {aiInsight.suggestions.map((suggestion) => (
              <div key={suggestion} className="rounded-2xl bg-sage/50 p-4 text-sm leading-6 text-ink/75">
                {suggestion}
              </div>
            ))}
            <div className="rounded-2xl bg-navy p-4 text-sm font-semibold leading-6 text-white md:col-span-3">{aiInsight.today_action}</div>
          </div>
        ) : null}
      </Card>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-xl font-bold tracking-normal text-ink">Daily spending trend</h2>
          {trendRows.length ? (
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendRows}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" />
                  <YAxis tickFormatter={(value) => compactCurrency(Number(value))} />
                  <Tooltip formatter={(value) => currency(Number(value))} />
                  <Line type="monotone" dataKey="amount" stroke="#0f3d3e" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState title="No trend yet" message="Add a few expenses to see your daily rhythm." />
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-xl font-bold tracking-normal text-ink">Category mix</h2>
          {categoryRows.length ? (
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryRows} dataKey="spent" nameKey="category" innerRadius={54} outerRadius={94}>
                    {categoryRows.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => currency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState title="No category spending" message="Category mix appears once expenses are saved." />
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-xl font-bold tracking-normal text-ink">Planned vs actual</h2>
          {plannedRows.length ? (
            <div className="mt-4 h-72">
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
            <div className="mt-4">
              <EmptyState title="No planned limits" message="Set category limits to compare planned and actual spending." />
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
              <EmptyState title="No household members" message="Invite household members to see a useful split here." />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
