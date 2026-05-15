const DAY_MS = 24 * 60 * 60 * 1000;

export function toISODate(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function getMonthStart(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

export function monthInputToStart(value: string) {
  if (!value) return getMonthStart();
  return `${value}-01`;
}

export function monthStartToInput(value: string) {
  return value.slice(0, 7);
}

export function addMonthsToMonthStart(monthStart: string, offset: number) {
  const [year, month] = monthStart.split("-").map(Number);
  return getMonthStart(new Date(year, month - 1 + offset, 1));
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

export function formatRelativeTime(value: string, now: Date = new Date()) {
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return "";
  const diffMs = now.getTime() - target.getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 5) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" }).format(target);
}
