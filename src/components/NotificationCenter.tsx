import {
  Bell,
  CheckCheck,
  CircleDollarSign,
  MessageSquare,
  PiggyBank,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHousehold } from "../contexts/HouseholdContext";
import { formatRelativeTime } from "../lib/date";
import type { Notification } from "../types";

function iconForType(type: string) {
  if (type === "expense_added") return CircleDollarSign;
  if (type === "expense_comment") return MessageSquare;
  if (type === "income_reminder") return Wallet;
  if (type === "recurring_due") return Wallet;
  if (type === "budget_overspent") return TrendingUp;
  if (type === "budget_warning") return TrendingUp;
  if (type.includes("saving")) return PiggyBank;
  if (type.includes("ai")) return Sparkles;
  return Bell;
}

function accentForType(type: string) {
  if (type === "expense_added") return "text-navy bg-navy/10";
  if (type === "expense_comment") return "text-moss bg-mint";
  if (type === "income_reminder") return "text-moss bg-mint";
  if (type === "recurring_due") return "text-gold bg-gold/15";
  if (type === "budget_overspent") return "text-coral bg-coral/10";
  if (type === "budget_warning") return "text-amber-600 bg-amber-100";
  if (type.includes("saving")) return "text-moss bg-mint";
  if (type.includes("ai")) return "text-navy bg-navy/10";
  return "text-ink/70 bg-sage/50";
}

function destinationForNotification(item: Notification) {
  if (item.type === "expense_comment" || item.type === "expense_added") return "/transactions";
  if (item.type === "income_reminder") return "/budget?add=income";
  if (item.type === "recurring_due") return "/budget";
  if (item.type.includes("budget")) return "/budget";
  if (item.type.includes("ai")) return "/insights";
  return "/";
}

export function NotificationCenter() {
  const { notifications, unreadNotificationCount, markNotificationRead, markAllNotificationsRead } = useHousehold();
  const [open, setOpen] = useState(false);
  const autoMarkedOpen = useRef(false);
  const navigate = useNavigate();
  const top = useMemo(() => notifications.slice(0, 12), [notifications]);

  useEffect(() => {
    if (!open) {
      autoMarkedOpen.current = false;
      return;
    }
    if (autoMarkedOpen.current || unreadNotificationCount === 0) return;
    autoMarkedOpen.current = true;
    void markAllNotificationsRead();
  }, [markAllNotificationsRead, open, unreadNotificationCount]);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("[data-notification-center]")) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" data-notification-center>
      <button
        className="relative rounded-xl border border-sage/80 bg-white p-2 text-ink/70 transition hover:bg-sage/40"
        aria-label="Notifications"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="h-5 w-5" />
        {unreadNotificationCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-bold text-white shadow">
            {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-96 max-w-[90vw] rounded-2xl border border-sage bg-white p-3 shadow-soft">
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <div>
              <p className="text-sm font-semibold text-ink">Household activity</p>
              <p className="text-[11px] text-ink/50">
                {unreadNotificationCount > 0
                  ? `${unreadNotificationCount} new update${unreadNotificationCount === 1 ? "" : "s"}`
                  : "You're all caught up"}
              </p>
            </div>
            {unreadNotificationCount > 0 ? (
              <button
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-moss hover:bg-mint"
                onClick={() => void markAllNotificationsRead()}
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-[28rem] space-y-1.5 overflow-auto pr-0.5">
            {top.length ? (
              top.map((item) => {
                const Icon = iconForType(item.type);
                const accent = accentForType(item.type);
                const unread = !item.read_at;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      void markNotificationRead(item.id);
                      setOpen(false);
                      navigate(destinationForNotification(item));
                    }}
                    className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition hover:bg-sage/30 ${
                      unread ? "bg-sage/40 ring-1 ring-sage" : "bg-mist"
                    }`}
                  >
                    <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${accent}`}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold leading-5 text-ink">{item.title}</span>
                        {unread ? <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-coral" aria-hidden="true" /> : null}
                      </span>
                      {item.body ? <span className="mt-0.5 block text-xs leading-5 text-ink/65">{item.body}</span> : null}
                      <span className="mt-1 block text-[11px] font-medium text-ink/45">{formatRelativeTime(item.created_at)}</span>
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="px-2 py-8 text-center">
                <Bell className="mx-auto h-8 w-8 text-ink/30" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold text-ink/70">No activity yet</p>
                <p className="mt-0.5 text-xs text-ink/50">When household members add transactions or comments, they'll show up here.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
