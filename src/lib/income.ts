import type { BudgetItem, HouseholdMember, PayFrequency } from "../types";
import { monthlyAmountForBudgetItem } from "./budget";

export const PAY_FREQUENCY_OPTIONS: Array<{ value: PayFrequency; label: string; helper: string; windowDays: number }> = [
  { value: "weekly", label: "Weekly", helper: "Paid every 7 days", windowDays: 7 },
  { value: "fortnightly", label: "Fortnightly", helper: "Paid every 14 days", windowDays: 14 },
  { value: "monthly", label: "Monthly", helper: "Paid once a month", windowDays: 31 },
];

export function windowDaysFor(frequency: PayFrequency | null | undefined) {
  return PAY_FREQUENCY_OPTIONS.find((option) => option.value === frequency)?.windowDays ?? 0;
}

export function frequencyLabel(frequency: PayFrequency | null | undefined) {
  return PAY_FREQUENCY_OPTIONS.find((option) => option.value === frequency)?.label ?? "Monthly";
}

function hasUsableIncomeFor(userId: string, items: BudgetItem[]) {
  return items.some((item) => {
    if (item.type !== "income") return false;
    if (!item.is_active || item.archived_at) return false;
    if (item.owner_user_id !== userId && item.created_by !== userId) return false;
    if (item.needs_amount) return false;
    const monthly = monthlyAmountForBudgetItem(item);
    return monthly !== null && monthly > 0;
  });
}

function daysBetween(later: Date, earlier: Date) {
  const ms = later.getTime() - earlier.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export type IncomeReminderState =
  | { kind: "needs_setup" }
  | { kind: "no_income"; frequency: PayFrequency; daysOverdue: number }
  | { kind: "due"; frequency: PayFrequency; daysOverdue: number; lastCheckedAt: string | null }
  | { kind: "ok"; frequency: PayFrequency; nextDueInDays: number };

export function getIncomeReminderState(
  member: HouseholdMember | undefined | null,
  budgetItems: BudgetItem[],
  now: Date = new Date(),
): IncomeReminderState | null {
  if (!member) return null;
  if (!member.pay_frequency) {
    return { kind: "needs_setup" };
  }
  const frequency = member.pay_frequency;
  const windowDays = windowDaysFor(frequency);
  const hasIncome = hasUsableIncomeFor(member.user_id, budgetItems);

  const lastTouchSource =
    member.last_income_checkin_at ?? member.pay_anchor_date ?? member.joined_at;
  const lastTouch = lastTouchSource ? new Date(lastTouchSource) : null;
  const daysSinceTouch = lastTouch ? daysBetween(now, lastTouch) : Infinity;

  if (!hasIncome) {
    return {
      kind: "no_income",
      frequency,
      daysOverdue: Math.max(0, daysSinceTouch === Infinity ? windowDays : daysSinceTouch - windowDays),
    };
  }

  if (daysSinceTouch >= windowDays) {
    return {
      kind: "due",
      frequency,
      daysOverdue: daysSinceTouch - windowDays,
      lastCheckedAt: member.last_income_checkin_at ?? null,
    };
  }

  return {
    kind: "ok",
    frequency,
    nextDueInDays: Math.max(0, windowDays - daysSinceTouch),
  };
}

export function reminderPeriodKey(frequency: PayFrequency, now: Date = new Date()) {
  if (frequency === "weekly") {
    const onejan = new Date(now.getFullYear(), 0, 1);
    const week = Math.ceil(((now.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
    return `${now.getFullYear()}-W${week}`;
  }
  if (frequency === "fortnightly") {
    const onejan = new Date(now.getFullYear(), 0, 1);
    const fortnight = Math.floor(((now.getTime() - onejan.getTime()) / 86400000 + onejan.getDay()) / 14);
    return `${now.getFullYear()}-F${fortnight}`;
  }
  return `${now.getFullYear()}-M${now.getMonth() + 1}`;
}
