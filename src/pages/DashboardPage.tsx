import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, BarChart3, Copy, Mail, PieChart as PieChartIcon, Plus, Trash2, UsersRound } from "lucide-react";
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
import { FinancialFreedomCard } from "../components/FinancialFreedomCard";
import { IncomePrankBanner } from "../components/IncomePrankBanner";
import { IncomeReminderBanner } from "../components/IncomeReminderBanner";
import { MonthSelector } from "../components/MonthSelector";
import { PageHeader } from "../components/PageHeader";
import { PaySetupPrompt } from "../components/PaySetupPrompt";
import { RefreshDataButton } from "../components/RefreshDataButton";
import { TransactionsList } from "../components/TransactionsList";
import { WarningBanner } from "../components/WarningBanner";
import { useAuth } from "../contexts/AuthContext";
import { useHousehold } from "../contexts/HouseholdContext";
import {
  budgetItemsForMonthlyTotals,
  buildCoachPayload,
  dailyTrend,
  findPotentialDuplicateBudgetItems,
  findPotentialDuplicateExpenses,
  monthlyAmountForBudgetItem,
  spendingByCategory,
  totalBudget,
  totalBudgetItemMonthlyIncome,
  totalSpent,
} from "../lib/budget";
import { requestBudgetCoach } from "../lib/coach";
import { daysLeftInMonth, formatMonthLabel } from "../lib/date";
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
    isOwner,
    saveAiInsight,
    clearLegacyMonthlyBudget,
  } = useHousehold();
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [dashboardNotice, setDashboardNotice] = useState<string | null>(null);
  const [clearingLegacy, setClearingLegacy] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  const monthLabel = formatMonthLabel(monthStart);
  const spent = totalSpent(expenses);
  const daysLeft = daysLeftInMonth(monthStart);
  const activeBudgetItems = useMemo(() => budgetItems.filter((item) => item.is_active && !item.archived_at), [budgetItems]);
  const activeBudgetItemsForTotals = useMemo(() => budgetItemsForMonthlyTotals(activeBudgetItems), [activeBudgetItems]);
  const duplicateBudgetGroups = useMemo(() => findPotentialDuplicateBudgetItems(activeBudgetItems), [activeBudgetItems]);
  const duplicateExpenseGroups = useMemo(() => findPotentialDuplicateExpenses(expenses), [expenses]);
  const categoryRows = useMemo(() => spendingByCategory(expenses, categories, budgetLimits), [expenses, categories, budgetLimits]);
  const trendRows = useMemo(() => dailyTrend(expenses), [expenses]);
  const legacyMonthlyIncome = Number(budgetMonth?.total_income ?? 0);
  const legacyMonthlyPlan = totalBudget(budgetMonth, budgetLimits);
  const hasMemberBudgetItems = activeBudgetItems.length > 0;
  const itemMonthlyIncome = totalBudgetItemMonthlyIncome(activeBudgetItemsForTotals);
  const hasLegacyBudgetData = legacyMonthlyIncome > 0 || legacyMonthlyPlan > 0;
  const combinedMonthlyIncome = hasMemberBudgetItems ? itemMonthlyIncome : legacyMonthlyIncome;
  const combinedPersonalExpenses = monthlyItemTotal(
    activeBudgetItemsForTotals,
    (item) => item.scope === "personal" && item.type !== "income" && item.type !== "debt" && item.type !== "saving" && item.type !== "buffer" && item.type !== "info",
  );
  const combinedSharedExpenses = monthlyItemTotal(
    activeBudgetItemsForTotals,
    (item) => item.scope === "shared" && item.type !== "income" && item.type !== "debt" && item.type !== "saving" && item.type !== "buffer" && item.type !== "info",
  );
  const combinedDebtRepayments = monthlyItemTotal(activeBudgetItemsForTotals, (item) => item.type === "debt");
  const combinedSavingsGoal = monthlyItemTotal(activeBudgetItemsForTotals, (item) => item.type === "saving" || item.type === "buffer");
  const remaining = combinedMonthlyIncome > 0 ? combinedMonthlyIncome - spent : 0;
  const spentPercent = combinedMonthlyIncome > 0 ? Math.min(100, (spent / combinedMonthlyIncome) * 100) : 0;
  const safeDaily = daysLeft > 0 && remaining > 0 ? remaining / daysLeft : 0;

  const currentUserItems = useMemo(
    () => activeBudgetItemsForTotals.filter((item) => item.owner_user_id === user?.id || item.created_by === user?.id),
    [activeBudgetItemsForTotals, user?.id],
  );
  const memberSetupRows = useMemo(
    () =>
      members.map((member) => {
        const hasData = activeBudgetItems.some((item) => item.owner_user_id === member.user_id || item.created_by === member.user_id);
        return { member, hasData, ready: Boolean(member.budget_setup_completed_at || hasData) };
      }),
    [activeBudgetItems, members],
  );
  const membersReadyCount = memberSetupRows.filter((item) => item.ready).length;
  const allMembersReady = memberSetupRows.length > 0 && memberSetupRows.every((item) => item.ready);
  const currentUserReady = Boolean(members.find((m) => m.user_id === user?.id)?.budget_setup_completed_at || currentUserItems.length > 0);
  const waitingForPartnerData = members.length < 2 || !allMembersReady;

  const memberSpendingRows = useMemo(
    () =>
      members.map((member, index) => {
        const memberExpenses = expenses.filter((e) => e.user_id === member.user_id);
        const memberItems = activeBudgetItemsForTotals.filter((item) => item.owner_user_id === member.user_id || item.created_by === member.user_id);
        return {
          name: personName(member.profile?.display_name, member.profile?.email ?? `Member ${index + 1}`),
          spent: memberExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
          income: monthlyItemTotal(memberItems, (item) => item.type === "income"),
          Income: monthlyItemTotal(memberItems, (item) => item.type === "income"),
          Expenses: monthlyItemTotal(memberItems, (item) => item.type !== "income" && item.type !== "info"),
        };
      }),
    [activeBudgetItemsForTotals, expenses, members],
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

  const inviteMessage = household
    ? `Hi,\n\nI am setting up our MoneyMates household budget so we can see the monthly picture clearly.\n\nCould you join with this household key and add your regular income, bills, repayments, savings goals, and any shared expenses you usually cover?\n\nHousehold key: ${household.join_code}\n\nYou only need your own account. Please do not share passwords or bank login details.\n\nThanks.`
    : "";
  const inviteMailTo = `mailto:?subject=${encodeURIComponent("MoneyMates household budget")}&body=${encodeURIComponent(inviteMessage)}`;
  const copyInviteMessage = async () => {
    if (!inviteMessage) return;
    await navigator.clipboard.writeText(inviteMessage);
    setInviteCopied(true);
  };
  const copyJoinCode = async () => {
    if (!household?.join_code) return;
    await navigator.clipboard.writeText(household.join_code);
    setInviteCopied(true);
  };
  const handleClearLegacy = async () => {
    const confirmed = window.confirm("Clear the old monthly plan and category limits for this month? Member budget items and transactions will stay.");
    if (!confirmed) return;
    setClearingLegacy(true);
    setDashboardNotice(null);
    try {
      await clearLegacyMonthlyBudget();
      setDashboardNotice("Old monthly totals cleared. The dashboard now uses member-owned budget items.");
    } catch (caught) {
      setDashboardNotice(caught instanceof Error ? caught.message : "Could not clear old monthly totals.");
    } finally {
      setClearingLegacy(false);
    }
  };

  return (
    <div>
      <IncomePrankBanner hasIncome={combinedMonthlyIncome > 0} />
      <PageHeader
        eyebrow={monthLabel}
        title="Dashboard"
        description="Your household's financial picture at a glance."
        action={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <MonthSelector />
            <RefreshDataButton className="w-full sm:w-auto" />
            <Link
              to="/transactions"
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white shadow-soft hover:bg-ink sm:w-auto"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add expense
            </Link>
          </div>
        }
      />

      {dashboardNotice ? (
        <div className="mb-5">
          <WarningBanner>{dashboardNotice}</WarningBanner>
        </div>
      ) : null}

      <PaySetupPrompt />
      <IncomeReminderBanner />

      {/* ── SPENDING HERO ── */}
      {(spent > 0 || combinedMonthlyIncome > 0) ? (
        <Card className="mb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-moss">
                {combinedMonthlyIncome > 0 ? "Monthly budget" : "Spending this month"}
              </p>
              <p className="mt-1 text-4xl font-bold tracking-tight text-ink">{currency(spent)}</p>
              {combinedMonthlyIncome > 0 ? (
                <p className="mt-1 text-sm text-ink/60">
                  of {currency(combinedMonthlyIncome)} income &mdash;{" "}
                  <span className={remaining < 0 ? "font-semibold text-coral" : "font-semibold text-moss"}>
                    {remaining < 0 ? `${currency(Math.abs(remaining))} over` : `${currency(remaining)} remaining`}
                  </span>
                </p>
              ) : null}
            </div>
            {safeDaily > 0 ? (
              <div className="rounded-2xl bg-mint px-4 py-3 text-center sm:text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-moss">Safe to spend today</p>
                <p className="mt-1 text-2xl font-bold text-moss">{currency(safeDaily)}</p>
                <p className="mt-0.5 text-xs text-moss/70">{daysLeft} day{daysLeft === 1 ? "" : "s"} left in {monthLabel.split(" ")[0]}</p>
              </div>
            ) : null}
          </div>

          {combinedMonthlyIncome > 0 ? (
            <div className="mt-5">
              <div className="flex justify-between text-xs font-semibold text-ink/50 mb-1">
                <span>{Math.round(spentPercent)}% spent</span>
                <span>{currency(remaining)} left</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-sage/50">
                <div
                  className={`h-full rounded-full transition-all ${spentPercent > 90 ? "bg-coral" : spentPercent > 70 ? "bg-amber-400" : "bg-navy"}`}
                  style={{ width: `${spentPercent}%` }}
                />
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-4">
                {combinedPersonalExpenses > 0 ? (
                  <div className="rounded-xl bg-mist px-3 py-2.5">
                    <p className="text-xs font-semibold uppercase text-ink/45">Personal bills</p>
                    <p className="mt-1 font-bold text-ink">{currency(combinedPersonalExpenses)}</p>
                  </div>
                ) : null}
                {combinedSharedExpenses > 0 ? (
                  <div className="rounded-xl bg-mist px-3 py-2.5">
                    <p className="text-xs font-semibold uppercase text-ink/45">Shared</p>
                    <p className="mt-1 font-bold text-ink">{currency(combinedSharedExpenses)}</p>
                  </div>
                ) : null}
                {combinedDebtRepayments > 0 ? (
                  <div className="rounded-xl bg-mist px-3 py-2.5">
                    <p className="text-xs font-semibold uppercase text-ink/45">Debt</p>
                    <p className="mt-1 font-bold text-ink">{currency(combinedDebtRepayments)}</p>
                  </div>
                ) : null}
                {combinedSavingsGoal > 0 ? (
                  <div className="rounded-xl bg-mist px-3 py-2.5">
                    <p className="text-xs font-semibold uppercase text-ink/45">Savings</p>
                    <p className="mt-1 font-bold text-ink">{currency(combinedSavingsGoal)}</p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}

      {/* ── FINANCIAL FREEDOM ── */}
      <FinancialFreedomCard
        monthlyIncome={combinedMonthlyIncome}
        monthlySavings={combinedSavingsGoal}
        monthlyDebtPaydown={combinedDebtRepayments}
        monthlyPlannedExpenses={combinedPersonalExpenses + combinedSharedExpenses}
      />

      {/* ── MEMBER SPENDING ── */}
      {memberSpendingRows.length > 0 && memberSpendingRows.some((r) => r.spent > 0 || r.income > 0) ? (
        <div className={`mb-5 grid gap-3 ${memberSpendingRows.length > 1 ? "sm:grid-cols-2" : ""}`}>
          {memberSpendingRows.map((row) => (
            <Card key={row.name} className="p-4">
              <p className="text-sm font-semibold text-moss">{row.name}</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {row.income > 0 ? (
                  <div>
                    <p className="text-xs font-semibold uppercase text-ink/45">Income</p>
                    <p className="mt-1 text-xl font-bold text-ink">{currency(row.income)}</p>
                  </div>
                ) : null}
                <div>
                  <p className="text-xs font-semibold uppercase text-ink/45">Spent</p>
                  <p className="mt-1 text-xl font-bold text-ink">{currency(row.spent)}</p>
                </div>
                {row.income > 0 ? (
                  <div>
                    <p className="text-xs font-semibold uppercase text-ink/45">Remaining</p>
                    <p className={`mt-1 text-xl font-bold ${row.income - row.spent < 0 ? "text-coral" : "text-ink"}`}>
                      {currency(row.income - row.spent)}
                    </p>
                  </div>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {/* ── HOUSEHOLD SETUP / INVITE ── */}
      {household && waitingForPartnerData ? (
        <Card className="mb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-sage p-2 text-navy">
                <UsersRound className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-moss">
                  {members.length < 2 ? "Invite your partner" : "Waiting for household members"}
                </p>
                <h2 className="mt-1 text-xl font-bold tracking-normal text-ink">
                  {members.length < 2
                    ? currentUserReady
                      ? "Your part is done. Share the household key to see the full picture."
                      : "Start your budget, then invite your partner."
                    : `${membersReadyCount}/${members.length} members have added their budget.`}
                </h2>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col lg:items-stretch">
              {members.length < 2 ? (
                <Button type="button" variant="secondary" onClick={() => void copyInviteMessage()}>
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  {inviteCopied ? "Copied!" : "Copy invite"}
                </Button>
              ) : null}
              <Link
                to={currentUserReady ? "/budget" : "/onboarding"}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white shadow-soft hover:bg-ink"
              >
                {currentUserReady ? "Review budget" : "Open setup"}
              </Link>
              {hasMemberBudgetItems && hasLegacyBudgetData && isOwner ? (
                <Button type="button" variant="ghost" loading={clearingLegacy} onClick={() => void handleClearLegacy()}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Clear old plan
                </Button>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      {/* ── DUPLICATES ── */}
      {(duplicateBudgetGroups.length > 0 || duplicateExpenseGroups.length > 0) ? (
        <Card className="mb-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-coral/10 p-2 text-coral">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-coral">Possible duplicates found</p>
              <p className="mt-1 text-sm leading-6 text-ink/65">
                Budget duplicates are counted once. Transaction duplicates stay until the member removes one.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {duplicateBudgetGroups.map((group) => (
              <div key={group.key} className="flex items-center justify-between rounded-xl border border-coral/20 bg-coral/5 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-ink">{group.label}</p>
                  <p className="text-xs text-ink/60">{group.items.length} similar budget items</p>
                </div>
                <Link className="rounded-lg bg-white px-2 py-1 text-xs font-semibold text-ink ring-1 ring-sage" to="/budget">
                  Review
                </Link>
              </div>
            ))}
            {duplicateExpenseGroups.map((group) => (
              <div key={group.key} className="rounded-xl border border-coral/20 bg-coral/5 px-3 py-2">
                <p className="text-sm font-semibold text-ink">{group.label}</p>
                <p className="text-xs text-ink/60">
                  {group.expenses.length} matching on {group.expenses[0]?.spent_on} for {currency(group.amount)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/* ── CHARTS ── */}
      <div className="mt-2 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-normal text-ink">Spending by category</h2>
            <PieChartIcon className="h-5 w-5 text-moss" aria-hidden="true" />
          </div>
          {categoryRows.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryRows} dataKey="spent" nameKey="category" innerRadius={50} outerRadius={88} paddingAngle={2}>
                    {categoryRows.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => currency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="No spending yet" message="Add expenses to see the category breakdown." />
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-normal text-ink">Income vs expenses by member</h2>
            <BarChart3 className="h-5 w-5 text-moss" aria-hidden="true" />
          </div>
          {memberSpendingRows.some((r) => r.Income > 0 || r.Expenses > 0) ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={memberSpendingRows}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => compactCurrency(Number(v))} />
                  <Tooltip formatter={(v) => currency(Number(v))} />
                  <Legend />
                  <Bar dataKey="Income" fill="#2f6b57" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Expenses" fill="#c78f5b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="No member plan yet" message="Add income and expenses to see the member comparison." />
          )}
        </Card>
      </div>

      {/* ── TREND + AI COACH ── */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <h2 className="text-xl font-bold tracking-normal text-ink">Daily spending trend</h2>
          {trendRows.length ? (
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendRows}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => compactCurrency(Number(v))} />
                  <Tooltip formatter={(v) => currency(Number(v))} />
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
              <p className="text-sm font-semibold text-moss">AI Budget Coach</p>
              <h2 className="mt-1 text-xl font-bold tracking-normal text-ink">
                {aiInsight?.summary ?? "Get a personalised read on your spending this month."}
              </h2>
            </div>
            <Button onClick={handleCoach} loading={coachLoading} variant="secondary">
              Ask Coach
            </Button>
          </div>
          {aiInsight ? (
            <div className="mt-4 space-y-3 text-sm leading-6 text-ink/70">
              {aiInsight.today_action ? <p className="rounded-xl bg-mint px-3 py-2 font-medium text-moss">{aiInsight.today_action}</p> : null}
              {aiInsight.warning ? <WarningBanner>{aiInsight.warning}</WarningBanner> : null}
              {aiInsight.suggestions?.length ? (
                <ul className="space-y-1 pl-4">
                  {aiInsight.suggestions.map((s, i) => (
                    <li key={i} className="list-disc">{s}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-ink/65">
              The coach sees only summarised budget data &mdash; no bank account access.
            </p>
          )}
          {coachError ? (
            <div className="mt-3">
              <WarningBanner tone="strong">{coachError}</WarningBanner>
            </div>
          ) : null}
        </Card>
      </div>

      {/* ── RECENT TRANSACTIONS ── */}
      <div className="mt-4">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-normal text-ink">Recent transactions</h2>
            <Link to="/transactions" className="text-sm font-semibold text-moss hover:underline">
              View all
            </Link>
          </div>
          <div className="mt-2">
            <TransactionsList
              expenses={expenses}
              limit={6}
              emptyTitle="No expenses this month"
              emptyMessage="Use the month selector to review a past month, or add a new expense."
            />
          </div>
        </Card>
      </div>

      {/* ── ACTIVITY FEED ── */}
      {notifications.length > 0 ? (
        <div className="mt-4">
          <Card>
            <h2 className="text-xl font-bold tracking-normal text-ink">Recent activity</h2>
            <div className="mt-3 space-y-2">
              {notifications.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-xl border border-sage/70 bg-mist px-3 py-2">
                  <p className="text-sm font-semibold text-ink">{item.title}</p>
                  <p className="text-xs text-ink/70">{item.body}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : null}

      {/* Invite card when all set up */}
      {household && !waitingForPartnerData && members.length < 2 ? (
        <div className="mt-4">
          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-moss">Invite your partner</p>
                <p className="mt-1 text-sm leading-6 text-ink/65">Share the household key so they can add their income and expenses.</p>
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
                <Button type="button" variant="secondary" onClick={() => void copyInviteMessage()}>
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  {inviteCopied ? "Copied!" : "Copy invite"}
                </Button>
                <a
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white shadow-soft hover:bg-ink"
                  href={inviteMailTo}
                >
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  Email invite
                </a>
                <Button type="button" variant="ghost" onClick={() => void copyJoinCode()}>
                  Copy key only
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
