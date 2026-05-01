import { BUDGET_START_MONTH } from "./constants";

const DAY_MS = 24 * 60 * 60 * 1000;

export function toISODate(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function getMonthStart(date = new Date()) {
  const localMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
  return localMonth < BUDGET_START_MONTH ? BUDGET_START_MONTH : localMonth;
}

export function monthInputToStart(value: string) {
  if (!value) return BUDGET_START_MONTH;
  return `${value}-01`;
}

export function monthStartToInput(value: string) {
  return value.slice(0, 7);
}

export function getMonthBounds(monthStart: string) {
  const [year, month] = monthStart.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    start: toISODate(start),
    end: toISODate(end),
  };
}

export function daysInMonth(monthStart: string) {
  const [year, month] = monthStart.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

export function daysLeftInMonth(monthStart: string, today = new Date()) {
  const currentMonth = getMonthStart(today);
  if (monthStart !== currentMonth) {
    return daysInMonth(monthStart);
  }

  const [year, month] = monthStart.split("-").map(Number);
  const end = new Date(year, month, 0);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(1, Math.floor((end.getTime() - todayStart.getTime()) / DAY_MS) + 1);
}

export function formatMonthLabel(monthStart: string) {
  const [year, month] = monthStart.split("-").map(Number);
  return new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

export function formatShortDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" }).format(new Date(year, month - 1, day));
}
