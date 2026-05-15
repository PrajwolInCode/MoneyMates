import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, CheckCircle2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useHousehold } from "../contexts/HouseholdContext";
import { frequencyLabel, getIncomeReminderState, reminderPeriodKey } from "../lib/income";
import { Button } from "./Button";
import { Card } from "./Card";

const NOTIFY_KEY = (householdId: string, userId: string, periodKey: string) =>
  `moneymates_income_reminder_notified_${householdId}_${userId}_${periodKey}`;

export function IncomeReminderBanner() {
  const { user } = useAuth();
  const { household, members, budgetItems, markIncomeCheckedIn, insertReminderNotification } = useHousehold();
  const member = useMemo(() => members.find((row) => row.user_id === user?.id) ?? null, [members, user?.id]);
  const reminder = useMemo(() => getIncomeReminderState(member, budgetItems), [member, budgetItems]);
  const [checkingIn, setCheckingIn] = useState(false);
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (!household || !user || !reminder) return;
    if (reminder.kind !== "due" && reminder.kind !== "no_income") return;
    if (notifiedRef.current) return;
    const freq = reminder.kind === "due" ? reminder.frequency : reminder.frequency;
    const periodKey = reminderPeriodKey(freq);
    const storageKey = NOTIFY_KEY(household.id, user.id, periodKey);
    if (window.localStorage.getItem(storageKey)) return;
    notifiedRef.current = true;
    try {
      window.localStorage.setItem(storageKey, String(Date.now()));
    } catch {
      // ignore
    }
    const title =
      reminder.kind === "no_income"
        ? `Add your ${frequencyLabel(freq).toLowerCase()} income`
        : `Time to update your ${frequencyLabel(freq).toLowerCase()} income`;
    const body =
      reminder.kind === "no_income"
        ? "We can't run your budget yet because your income isn't set. Add it on the Budget page."
        : "It's been a full pay cycle since your last income check-in. Confirm or update your income.";
    void insertReminderNotification({
      type: "income_reminder",
      title,
      body,
      metadata: { period_key: periodKey, pay_frequency: freq },
    });
  }, [household?.id, user?.id, reminder, insertReminderNotification]);

  if (!member || !reminder) return null;
  if (reminder.kind !== "due" && reminder.kind !== "no_income") return null;

  const freq = reminder.frequency;
  const label = frequencyLabel(freq).toLowerCase();
  const headline =
    reminder.kind === "no_income"
      ? `Add your ${label} income to start the budget`
      : `Time to check in on your ${label} income`;
  const helper =
    reminder.kind === "no_income"
      ? "We can't show what's safe to spend until you tell us how much you take home each pay cycle."
      : `${reminder.daysOverdue > 0 ? `${reminder.daysOverdue} day${reminder.daysOverdue === 1 ? "" : "s"} past your usual pay cycle. ` : ""}Confirm income hasn't changed, or update it.`;

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      await markIncomeCheckedIn();
    } finally {
      setCheckingIn(false);
    }
  };

  return (
    <Card className="mb-5 border-coral/30 bg-gradient-to-br from-white via-white to-coral/5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-coral/15 p-2.5 text-coral">
            <CalendarClock className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-coral">Income reminder</p>
            <h2 className="mt-1 text-lg font-bold tracking-normal text-ink">{headline}</h2>
            <p className="mt-1 text-sm leading-6 text-ink/65">{helper}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-stretch">
          <Link
            to="/budget?add=income"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white shadow-soft hover:bg-ink"
          >
            {reminder.kind === "no_income" ? "Add income" : "Update income"}
          </Link>
          {reminder.kind === "due" ? (
            <Button variant="secondary" onClick={() => void handleCheckIn()} loading={checkingIn}>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Income hasn't changed
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
