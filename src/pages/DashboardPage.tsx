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
import { MonthSelector } from "../components/MonthSelector";
import { PageHeader } from "../components/PageHeader";
import { ProgressBar } from "../components/ProgressBar";
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
  totalBudgetItemMonthlyPlannedExpenses,
  totalSpent,
} from "../lib/budget";
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
  const itemMonthlyPlan = totalBudgetItemMonthlyPlannedExpenses(activeBudgetItemsForTotals);
  const hasLegacyBudgetData = legacyMonthlyIncome > 0 || legacyMonthlyPlan > 0;
  const useLegacyBudgetData = !hasMemberBudgetItems && hasLegacyBudgetData;
  const hasBudgetPlanData = hasMemberBudgetItems || useLegacyBudgetData;
  const hasNoHouseholdData = !expenses.length && !budgetItems.length && !budgetLimits.length && !hasLegacyBudgetData;
  const currentUserItems = useMemo(
    () => activeBudgetItemsForTotals.filter((item) => item.owner_user_id === user?.id || item.created_by === user?.id),
    [activeBudgetItemsForTotals, user?.id],
  );
  const currentMember = members.find((member) => member.user_id === user?.id);
  const memberSetupRows = useMemo(
    () =>
      members.map((member) => {
        const hasData = activeBudgetItems.some((item) => item.owner_user_id === member.user_id || item.created_by === member.user_id);
        return {
          member,
          hasData,
          ready: Boolean(member.budget_setup_completed_at || hasData),
        };
      }),
    [activeBudgetItems, members],
  );
  const membersReadyCount = memberSetupRows.filter((item) => item.ready).length;
  const allMembersReady = memberSetupRows.length > 0 && memberSetupRows.every((item) => item.ready);
  const currentUserHasBudgetData = currentUserItems.length > 0 || useLegacyBudgetData;
  const currentUserReady = Boolean(currentMember?.budget_setup_completed_at || currentUserItems.length > 0);
  const waitingForPartnerData = members.length < 2 || !allMembersReady;
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
  const combinedMonthlyPlan = hasMemberBudgetItems
    ? combinedPersonalExpenses + combinedSharedExpenses + combinedDebtRepayments + combinedSavingsGoal || itemMonthlyPlan
    : legacyMonthlyPlan;
  const combinedExpectedRemaining = combinedMonthlyIncome - combinedMonthlyPlan;
  const savingsProgressAmount = Math.max(0, combinedMonthlyIncome - spent - (combinedMonthlyPlan - combinedSavingsGoal));
  const savingsProgress = combinedSavingsGoal > 0 ? Math.min(100, (savingsProgressAmount / combinedSavingsGoal) * 100) : 0;
  const itemCurrentUserIncome = monthlyItemTotal(currentUserItems, (item) => item.type === "income");
  const currentUserIncome = hasMemberBudgetItems ? itemCurrentUserIncome : legacyMonthlyIncome;
  const currentUserPersonalBills = monthlyItemTotal(
    currentUserItems,
    (item) => item.scope === "personal" && item.type !== "income" && item.type !== "debt" && item.type !== "saving" && item.type !== "buffer" && item.type !== "info",
  );
  const currentUserSharedExpenses = monthlyItemTotal(
    currentUserItems,
    (item) => item.scope === "shared" && item.type !== "income" && item.type !== "debt" && item.type !== "saving" && item.type !== "buffer" && item.type !== "info",
  );
  const currentUserDebt = monthlyItemTotal(currentUserItems, (item) => item.type === "debt");
  const currentUserSavings = monthlyItemTotal(currentUserItems, (item) => item.type === "saving" || item.type === "buffer");
  const currentUserExpectedRemaining = currentUserIncome - currentUserPersonalBills - currentUserSharedExpenses - currentUserDebt - currentUserSavings;
  const equationIncome = waitingForPartnerData ? currentUserIncome : combinedMonthlyIncome;
  const equationPersonal = waitingForPartnerData ? currentUserPersonalBills : combinedPersonalExpenses;
  const equationShared = waitingForPartnerData ? currentUserSharedExpenses : combinedSharedExpenses;
  const equationDebt = waitingForPartnerData ? currentUserDebt : combinedDebtRepayments;
  const equationSavings = waitingForPartnerData ? currentUserSavings : combinedSavingsGoal;
  const equationRemaining = equationIncome - equationPersonal - equationShared - equationDebt - equationSavings;
  const actualFlowLeft = equationIncome - spent;
  const calculatorRows = [
    { label: "Income", value: equationIncome, show: equationIncome > 0 },
    { label: "Personal bills", value: -equationPersonal, show: equationPersonal > 0 },
    { label: "Shared expenses", value: -equationShared, show: equationShared > 0 },
    { label: "Debt", value: -equationDebt, show: equationDebt > 0 },
    { label: "Savings", value: -equationSavings, show: equationSavings > 0 },
    { label: "Tracked spending", value: -spent, show: spent > 0 },
    { label: "Planned left", value: equationRemaining, show: equationIncome > 0 || equationPersonal > 0 || equationShared > 0 || equationDebt > 0 || equationSavings > 0 },
    { label: "Actual left", value: actualFlowLeft, show: equationIncome > 0 || spent > 0 },
  ].filter((item) => item.show);
  const memberBudgetRows = useMemo(
    () =>
      members.map((member, index) => {
        const memberItems = activeBudgetItemsForTotals.filter((item) => item.owner_user_id === member.user_id || item.created_by === member.user_id);
        const memberExpenses = monthlyItemTotal(memberItems, (item) => item.type !== "income" && item.type !== "info");
        return {
          name: personName(member.profile?.display_name, member.profile?.email ?? `Member ${index + 1}`),
          Income: monthlyItemTotal(memberItems, (item) => item.type === "income"),
          Expenses: memberExpenses,
          Personal: monthlyItemTotal(memberItems, (item) => item.scope === "personal" && item.type !== "income" && item.type !== "info"),
        };
      }),
    [activeBudgetItemsForTotals, members],
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
  const inviteMessage = household
    ? `Hi,\n\nI am setting up our MoneyMates household budget so we can see the monthly picture clearly.\n\nCould you join with this household key and add your regular income, bills, repayments, savings goals, and any shared expenses you usually cover?\n\nHousehold key: ${household.join_code}\n\nYou only need your own account. Please do not share passwords or bank login details.\n\nThanks.`
    : "";
  const inviteMailTo = `mailto:?subject=${encodeURIComponent("MoneyMates household budget")}&body=${encodeURIComponent(inviteMessage)}`;
  const copyInviteMessage = async () => {
    if (!inviteMessage) return;
    await navigator.clipboard.writeText(inviteMessage);
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
  const setupEyebrow = waitingForPartnerData ? "Shared household setup" : "Shared household budget";
  const setupTitle = waitingForPartnerData
    ? members.length < 2
      ? currentUserReady
        ? "Your part is ready. Invite your partner when you want the full household picture."
        : "Start your part, then invite your partner when you are ready."
      : currentUserReady
        ? "Your part is ready. Waiting for the other member to finish their part."
        : "Add your part so the shared household budget can be completed."
    : "Your shared household budget is ready to review.";
  const setupDescription = waitingForPartnerData
    ? members.length < 2
      ? "This is a shared budget space. Each member adds their own income, bills, repayments, savings, and shared expenses from their own account."
      : "MoneyMates will show the full household view once each member has finished setup or added their budget items."
    : `${membersReadyCount}/${members.length || 1} members are ready. Shared expenses are combined once, and personal items stay under each member.`;

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

      {dashboardNotice ? (
        <div className="mb-5">
          <WarningBanner>{dashboardNotice}</WarningBanner>
        </div>
      ) : null}

      {household ? (
        <Card className="mb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-sage p-2 text-navy">
                <UsersRound className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-moss">{setupEyebrow}</p>
                <h2 className="mt-1 text-xl font-bold tracking-normal text-ink">{setupTitle}</h2>
                <p className="mt-2 text-sm leading-6 text-ink/65">{setupDescription}</p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[24rem]">
              <div className="rounded-xl bg-mist px-3 py-3">
                <p className="text-xs font-semibold uppercase text-ink/45">Setup</p>
                <p className="mt-1 text-lg font-bold text-ink">
                  {membersReadyCount}/{members.length || 1}
                </p>
              </div>
              {hasBudgetPlanData ? (
                <>
                  {combinedMonthlyIncome > 0 ? (
                  <div className="rounded-xl bg-mist px-3 py-3">
                    <p className="text-xs font-semibold uppercase text-ink/45">Income</p>
                    <p className="mt-1 text-lg font-bold text-ink">{currency(combinedMonthlyIncome)}</p>
                  </div>
                  ) : null}
                  {combinedMonthlyPlan > 0 ? (
                  <div className="rounded-xl bg-mist px-3 py-3">
                    <p className="text-xs font-semibold uppercase text-ink/45">Planned costs</p>
                    <p className="mt-1 text-lg font-bold text-ink">{currency(combinedMonthlyPlan)}</p>
                  </div>
                  ) : null}
                </>
              ) : null}
              {hasMemberBudgetItems && hasLegacyBudgetData ? (
                <div className="rounded-xl bg-coral/10 px-3 py-3 sm:col-span-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase text-coral">Old plan not counted</p>
                      <p className="mt-1 text-sm font-semibold text-ink">{currency(legacyMonthlyPlan || legacyMonthlyIncome)} came from the old setup.</p>
                    </div>
                    {isOwner ? (
                      <Button type="button" variant="secondary" loading={clearingLegacy} onClick={() => void handleClearLegacy()}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Clear
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {waitingForPartnerData ? (
                <>
                  {members.length < 2 ? (
                    <Button type="button" variant="secondary" className="sm:col-span-2" onClick={() => void copyInviteMessage()}>
                      <Copy className="h-4 w-4" aria-hidden="true" />
                      {inviteCopied ? "Invite copied" : "Copy invite message"}
                    </Button>
                  ) : null}
                  <Link
                    to={currentUserReady ? "/budget" : "/onboarding"}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white shadow-soft hover:bg-ink"
                  >
                    {currentUserReady ? "Review budget" : "Open setup"}
                  </Link>
                </>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      {duplicateBudgetGroups.length || duplicateExpenseGroups.length ? (
        <Card className="mb-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-coral/10 p-2 text-coral">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-coral">Smart duplicate check</p>
              <h2 className="mt-1 text-xl font-bold tracking-normal text-ink">Review items that look repeated.</h2>
              <p className="mt-2 text-sm leading-6 text-ink/65">
                Budget duplicates are counted once in the monthly estimate. Transaction duplicates still stay in the record until the member who added them deletes one.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {duplicateBudgetGroups.map((group) => (
              <div key={group.key} className="rounded-xl border border-coral/20 bg-coral/5 px-3 py-3">
                <p className="font-semibold text-ink">{group.label}</p>
                <p className="mt-1 text-sm text-ink/65">
                  {group.items.length} similar budget items
                  {group.monthlyAmount === null ? "" : ` at ${currency(group.monthlyAmount)}/month`}
                </p>
                <Link className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-white px-3 py-2 text-sm font-semibold text-ink ring-1 ring-sage hover:ring-moss" to="/budget">
                  Review budget items
                </Link>
              </div>
            ))}
            {duplicateExpenseGroups.map((group) => (
              <div key={group.key} className="rounded-xl border border-coral/20 bg-coral/5 px-3 py-3">
                <p className="font-semibold text-ink">{group.label}</p>
                <p className="mt-1 text-sm text-ink/65">
                  {group.expenses.length} matching transactions on {group.expenses[0]?.spent_on} for {currency(group.amount)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {hasBudgetPlanData ? (
        <Card className="mb-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-moss">Monthly budget calculator</p>
              <h2 className="mt-1 text-2xl font-bold tracking-normal text-ink">
                {equationRemaining >= 0 ? "This plan leaves money to work with." : "This plan needs a small adjustment."}
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink/65">
                This is your monthly plan, not a bank balance. It shows what should be left after regular income, expenses, debt, and savings.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${equationRemaining >= 0 ? "bg-mint text-moss" : "bg-coral/10 text-coral"}`}>
                Planned left: {currency(equationRemaining)}
              </div>
              <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${actualFlowLeft >= 0 ? "bg-sage/60 text-navy" : "bg-coral/10 text-coral"}`}>
                Actual left: {currency(actualFlowLeft)}
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {calculatorRows.map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-mist px-3 py-3">
                <p className="text-xs font-semibold uppercase text-ink/45">{label}</p>
                <p className="mt-1 text-lg font-bold text-ink">{currency(Number(value))}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl bg-sage/45 px-3 py-2 text-sm leading-6 text-ink/70">
            Actual flow this month so far: {currency(equationIncome)} income minus {currency(spent)} tracked spending ={" "}
            <span className="font-bold text-ink">{currency(actualFlowLeft)}</span>.
          </div>
        </Card>
      ) : null}

      {waitingForPartnerData && currentUserHasBudgetData ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {currentUserIncome > 0 ? (
            <Card>
              <p className="text-sm font-semibold text-moss">Your income</p>
              <p className="mt-2 text-3xl font-bold tracking-normal text-ink">{currency(currentUserIncome)}</p>
            </Card>
          ) : null}
          {currentUserPersonalBills > 0 ? (
            <Card>
              <p className="text-sm font-semibold text-moss">Your personal bills</p>
              <p className="mt-2 text-3xl font-bold tracking-normal text-ink">{currency(currentUserPersonalBills)}</p>
            </Card>
          ) : null}
          {currentUserSavings > 0 ? (
            <Card>
              <p className="text-sm font-semibold text-moss">Your planned savings</p>
              <p className="mt-2 text-3xl font-bold tracking-normal text-ink">{currency(currentUserSavings)}</p>
            </Card>
          ) : null}
          {currentUserIncome > 0 || currentUserPersonalBills > 0 || currentUserSharedExpenses > 0 || currentUserDebt > 0 || currentUserSavings > 0 ? (
            <Card>
              <p className="text-sm font-semibold text-moss">Your expected remaining</p>
              <p className="mt-2 text-3xl font-bold tracking-normal text-ink">{currency(currentUserExpectedRemaining)}</p>
            </Card>
          ) : null}
          {spent > 0 || currentUserIncome > 0 ? (
            <Card>
              <p className="text-sm font-semibold text-moss">Your actual left</p>
              <p className={`mt-2 text-3xl font-bold tracking-normal ${actualFlowLeft < 0 ? "text-coral" : "text-ink"}`}>{currency(actualFlowLeft)}</p>
              <p className="mt-2 text-xs text-ink/55">After tracked spending this month</p>
            </Card>
          ) : null}
          <Card className="sm:col-span-2 lg:col-span-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-moss">Your part is ready</p>
                <h2 className="mt-1 text-xl font-bold tracking-normal text-ink">Your household picture will become clearer when everyone adds their part.</h2>
                <p className="mt-2 text-sm leading-6 text-ink/65">Invite your partner or household member so MoneyMates can combine income, bills, goals, and shared expenses.</p>
                {inviteMessage ? (
                  <p className="mt-3 rounded-xl bg-mist px-3 py-3 text-sm leading-6 text-ink/70">
                    Could you join with the household key and add your regular income, bills, repayments, savings goals, and any shared expenses you usually cover?
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
                <Button type="button" variant="secondary" onClick={() => void copyInviteMessage()}>
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  {inviteCopied ? "Invite copied" : "Copy invite"}
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
      ) : !waitingForPartnerData ? (
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
      ) : null}

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
