import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, Copy, PieChart as PieChartIcon, Plus, UsersRound } from "lucide-react";
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
import { EmptyState } from "../components/EmptyState";
import { MonthSelector } from "../components/MonthSelector";
import { PageHeader } from "../components/PageHeader";
import { ProgressBar } from "../components/ProgressBar";
import { RefreshDataButton } from "../components/RefreshDataButton";
import { TransactionsList } from "../components/TransactionsList";
import { WarningBanner } from "../components/WarningBanner";
import { useAuth } from "../contexts/AuthContext";
import { useHousehold } from "../contexts/HouseholdContext";
import { buildCoachPayload, dailyTrend, monthlyAmountForBudgetItem, spendingByCategory, totalBudgetItemMonthlyIncome, totalBudgetItemMonthlyPlannedExpenses, totalSpent } from "../lib/budget";
import { requestBudgetCoach } from "../lib/coach";
import { formatMonthLabel } from "../lib/date";
import { compactCurrency, currency, personName } from "../lib/format";
import type { BudgetItem } from "../types";

function monthlyItemTotal(items: BudgetItem[], predicate: (item: BudgetItem) => boolean) {
  return items.filter(predicate).reduce((sum, item) => sum + (monthlyAmountForBudgetItem(item) ?? 0), 0);
}

export function DashboardPage() {
  const { user } = useAuth();
  const {
    household,
    members,
    categories,
    budgetMonth,
    budgetLimits,
    budgetItems,
    expenses,
    recurringPayments,
    aiInsight,
    notifications,
    monthStart,
    saveAiInsight,
  } = useHousehold();
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  const monthLabel = formatMonthLabel(monthStart);
  const spent = totalSpent(expenses);
  const activeBudgetItems = useMemo(() => budgetItems.filter((item) => item.is_active && !item.archived_at), [budgetItems]);
  const categoryRows = useMemo(() => spendingByCategory(expenses, categories, budgetLimits), [expenses, categories, budgetLimits]);
  const trendRows = useMemo(() => dailyTrend(expenses), [expenses]);
  const hasNoHouseholdData = !expenses.length && !budgetItems.length && !budgetLimits.length;
  const currentUserItems = useMemo(
    () => activeBudgetItems.filter((item) => item.owner_user_id === user?.id || item.created_by === user?.id),
    [activeBudgetItems, user?.id],
  );
  const otherMembers = useMemo(() => members.filter((member) => member.user_id !== user?.id), [members, user?.id]);
  const otherMembersWithData = useMemo(
    () => otherMembers.filter((member) => activeBudgetItems.some((item) => item.owner_user_id === member.user_id || item.created_by === member.user_id)),
    [activeBudgetItems, otherMembers],
  );
  const memberContributorCount = otherMembersWithData.length + (currentUserItems.length ? 1 : 0);
  const waitingForPartnerData = members.length < 2 || otherMembersWithData.length === 0;
  const combinedMonthlyIncome = totalBudgetItemMonthlyIncome(activeBudgetItems);
  const combinedMonthlyPlan = totalBudgetItemMonthlyPlannedExpenses(activeBudgetItems);
  const combinedSharedExpenses = monthlyItemTotal(activeBudgetItems, (item) => item.scope === "shared" && item.type !== "income" && item.type !== "info");
  const combinedSavingsGoal = monthlyItemTotal(activeBudgetItems, (item) => item.type === "saving" || item.type === "buffer");
  const combinedExpectedRemaining = combinedMonthlyIncome - combinedMonthlyPlan;
  const savingsProgressAmount = Math.max(0, combinedMonthlyIncome - spent - (combinedMonthlyPlan - combinedSavingsGoal));
  const savingsProgress = combinedSavingsGoal > 0 ? Math.min(100, (savingsProgressAmount / combinedSavingsGoal) * 100) : 0;
  const currentUserIncome = monthlyItemTotal(currentUserItems, (item) => item.type === "income");
  const currentUserPersonalBills = monthlyItemTotal(
    currentUserItems,
    (item) => item.scope === "personal" && item.type !== "income" && item.type !== "saving" && item.type !== "buffer" && item.type !== "info",
  );
  const currentUserSavings = monthlyItemTotal(currentUserItems, (item) => item.type === "saving" || item.type === "buffer");
  const currentUserExpectedRemaining = currentUserIncome - currentUserPersonalBills - currentUserSavings;
  const memberBudgetRows = useMemo(
    () =>
      members.map((member, index) => {
        const memberItems = activeBudgetItems.filter((item) => item.owner_user_id === member.user_id || item.created_by === member.user_id);
        const memberExpenses = monthlyItemTotal(memberItems, (item) => item.type !== "income" && item.type !== "info");
        return {
          name: personName(member.profile?.display_name, member.profile?.email ?? `Member ${index + 1}`),
          Income: monthlyItemTotal(memberItems, (item) => item.type === "income"),
          Expenses: memberExpenses,
          Personal: monthlyItemTotal(memberItems, (item) => item.scope === "personal" && item.type !== "income" && item.type !== "info"),
        };
      }),
    [activeBudgetItems, members],
  );

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
        budgetItems,
      });
      const response = await requestBudgetCoach(payload);
      await saveAiInsight(response);
    } catch (caught) {
      setCoachError(caught instanceof Error ? caught.message : "The budget coach could not respond.");
    } finally {
      setCoachLoading(false);
    }
  };

  const copyJoinCode = async () => {
    if (!household?.join_code) return;
    await navigator.clipboard.writeText(household.join_code);
    setInviteCopied(true);
  };

  return (
    <div>
      <PageHeader
        eyebrow={monthLabel}
        title="Household dashboard"
        description="A simple daily view of what has been spent, what remains, and where a small adjustment would help."
        action={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <MonthSelector />
            <RefreshDataButton className="w-full sm:w-auto" />
            <Link
              to="/add"
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white shadow-soft hover:bg-ink sm:w-auto"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add expense
            </Link>
          </div>
        }
      />

      {hasNoHouseholdData ? (
        <Card className="mb-5">
          <p className="text-sm font-semibold text-moss">No household data yet</p>
          <p className="mt-2 text-sm leading-6 text-ink/65">
            This household loaded successfully, but there are no expenses, planned budget items, or legacy category limits for this month.
          </p>
        </Card>
      ) : null}

      {household ? (
        <Card className="mb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-sage p-2 text-navy">
                <UsersRound className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-moss">{waitingForPartnerData ? "Household setup" : "Combined household budget"}</p>
                <h2 className="mt-1 text-xl font-bold tracking-normal text-ink">
                  {waitingForPartnerData
                    ? currentUserItems.length
                      ? "Your part is ready. Invite your partner so MoneyMates can build the full household picture."
                      : "Start your part so MoneyMates can build the household picture."
                    : "MoneyMates is combining member budget items into one shared plan."}
                </h2>
                <p className="mt-2 text-sm leading-6 text-ink/65">
                  {waitingForPartnerData
                    ? members.length < 2
                      ? "Share the household key when you are ready. Your Supabase household data stays unchanged."
                      : "A household member has joined and can add their income, bills, repayments, expenses, and goals from their account."
                    : `${memberContributorCount} member${memberContributorCount === 1 ? "" : "s"} have budget data in this plan.`}
                </p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[24rem]">
              <div className="rounded-xl bg-mist px-3 py-3">
                <p className="text-xs font-semibold uppercase text-ink/45">Members</p>
                <p className="mt-1 text-lg font-bold text-ink">
                  {memberContributorCount}/{members.length || 1}
                </p>
              </div>
              <div className="rounded-xl bg-mist px-3 py-3">
                <p className="text-xs font-semibold uppercase text-ink/45">Income</p>
                <p className="mt-1 text-lg font-bold text-ink">{currency(combinedMonthlyIncome)}</p>
              </div>
              <div className="rounded-xl bg-mist px-3 py-3">
                <p className="text-xs font-semibold uppercase text-ink/45">Plan</p>
                <p className="mt-1 text-lg font-bold text-ink">{currency(combinedMonthlyPlan)}</p>
              </div>
              {waitingForPartnerData ? (
                <>
                  <Button type="button" variant="secondary" className="sm:col-span-2" onClick={() => void copyJoinCode()}>
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    {inviteCopied ? "Household key copied" : "Copy household key"}
                  </Button>
                  <Link
                    to="/onboarding"
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white shadow-soft hover:bg-ink"
                  >
                    Open setup
                  </Link>
                </>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      {waitingForPartnerData ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <p className="text-sm font-semibold text-moss">Your income</p>
            <p className="mt-2 text-3xl font-bold tracking-normal text-ink">{currency(currentUserIncome)}</p>
          </Card>
          <Card>
            <p className="text-sm font-semibold text-moss">Your personal bills</p>
            <p className="mt-2 text-3xl font-bold tracking-normal text-ink">{currency(currentUserPersonalBills)}</p>
          </Card>
          <Card>
            <p className="text-sm font-semibold text-moss">Your planned savings</p>
            <p className="mt-2 text-3xl font-bold tracking-normal text-ink">{currency(currentUserSavings)}</p>
          </Card>
          <Card>
            <p className="text-sm font-semibold text-moss">Your expected remaining</p>
            <p className="mt-2 text-3xl font-bold tracking-normal text-ink">{currency(currentUserExpectedRemaining)}</p>
          </Card>
          <Card className="sm:col-span-2 lg:col-span-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-moss">Your part is ready</p>
                <h2 className="mt-1 text-xl font-bold tracking-normal text-ink">Your household picture will become clearer when everyone adds their part.</h2>
                <p className="mt-2 text-sm leading-6 text-ink/65">Invite your partner or household member so MoneyMates can combine income, bills, goals, and shared expenses.</p>
              </div>
              <Button type="button" variant="secondary" onClick={() => void copyJoinCode()}>
                <Copy className="h-4 w-4" aria-hidden="true" />
                {inviteCopied ? "Household key copied" : "Copy household key"}
              </Button>
            </div>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <p className="text-sm font-semibold text-moss">Combined income</p>
            <p className="mt-2 text-3xl font-bold tracking-normal text-ink">{currency(combinedMonthlyIncome)}</p>
          </Card>
          <Card>
            <p className="text-sm font-semibold text-moss">Combined expenses</p>
            <p className="mt-2 text-3xl font-bold tracking-normal text-ink">{currency(combinedMonthlyPlan)}</p>
          </Card>
          <Card>
            <p className="text-sm font-semibold text-moss">Shared expenses</p>
            <p className="mt-2 text-3xl font-bold tracking-normal text-ink">{currency(combinedSharedExpenses)}</p>
          </Card>
          <Card>
            <p className="text-sm font-semibold text-moss">Expected remaining</p>
            <p className="mt-2 text-3xl font-bold tracking-normal text-ink">{currency(combinedExpectedRemaining)}</p>
          </Card>
          <Card>
            <p className="text-sm font-semibold text-moss">Actual spending this month</p>
            <p className="mt-2 text-3xl font-bold tracking-normal text-ink">{currency(spent)}</p>
          </Card>
          <Card>
            <p className="text-sm font-semibold text-moss">Savings progress</p>
            <p className="mt-2 text-3xl font-bold tracking-normal text-ink">{currency(Math.min(savingsProgressAmount, combinedSavingsGoal))}</p>
            <div className="mt-3">
              <ProgressBar value={savingsProgress} />
            </div>
            <p className="mt-2 text-xs text-ink/55">Goal: {currency(combinedSavingsGoal)}</p>
          </Card>
          <Card className="sm:col-span-2 lg:col-span-3">
            <p className="text-sm font-semibold text-moss">Personal expenses by member</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {memberBudgetRows.map((row) => (
                <div key={row.name} className="rounded-xl bg-mist px-3 py-3">
                  <p className="text-sm font-semibold text-ink">{row.name}</p>
                  <p className="mt-1 text-lg font-bold text-ink">{currency(row.Personal)}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-normal text-ink">Household spending categories</h2>
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
            <EmptyState title="No category spending yet" message="Add expenses to see a simple household category split." />
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-normal text-ink">Income vs expenses by member</h2>
            <BarChart3 className="h-5 w-5 text-moss" aria-hidden="true" />
          </div>
          {memberBudgetRows.some((row) => row.Income > 0 || row.Expenses > 0) ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={memberBudgetRows}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(value) => compactCurrency(Number(value))} />
                  <Tooltip formatter={(value) => currency(Number(value))} />
                  <Legend />
                  <Bar dataKey="Income" fill="#2f6b57" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Expenses" fill="#c78f5b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="No member plan yet" message="Add income and expenses to compare the member split." />
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <h2 className="text-xl font-bold tracking-normal text-ink">Actual spending this month</h2>
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-moss">Ask Coach</p>
              <h2 className="mt-1 text-xl font-bold tracking-normal text-ink">
                {aiInsight?.summary ?? "MoneyMates can look at your plan and suggest small ways to improve this month."}
              </h2>
            </div>
            <Button onClick={handleCoach} loading={coachLoading} variant="secondary">
              Ask Coach
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


      <div className="mt-5">
        <Card>
          <h2 className="text-xl font-bold tracking-normal text-ink">Real-time activity feed</h2>
          <div className="mt-3 space-y-2">
            {notifications.length ? (
              notifications.slice(0, 8).map((item) => (
                <div key={item.id} className="rounded-xl border border-sage/70 bg-mist px-3 py-2">
                  <p className="text-sm font-semibold text-ink">{item.title}</p>
                  <p className="text-xs text-ink/70">{item.body}</p>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-sage/80 bg-white px-3 py-4 text-sm text-ink/60">
                No household activity yet. Add an expense and it will appear here in real time.
              </p>
            )}
          </div>
        </Card>
      </div>
      <div className="mt-5">
        <Card>
          <h2 className="text-xl font-bold tracking-normal text-ink">Recent transactions</h2>
          <div className="mt-2">
            <TransactionsList
              expenses={expenses}
              limit={6}
              emptyTitle="No expenses for this month yet"
              emptyMessage="Use the month selector to review another month, or add an expense for this one."
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
