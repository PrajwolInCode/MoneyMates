import { Bell } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHousehold } from "../contexts/HouseholdContext";
import { formatShortDate } from "../lib/date";

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

  return (
    <div className="relative">
      <button
        className="relative rounded-xl border border-sage/80 bg-white p-2 text-ink/70 hover:bg-sage/40"
        aria-label="Notifications"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="h-5 w-5" />
        {unreadNotificationCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-bold text-white">
            {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-96 max-w-[85vw] rounded-2xl border border-sage bg-white p-3 shadow-soft">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-ink">Notification centre</p>
            {unreadNotificationCount > 0 ? (
              <button className="text-xs font-semibold text-moss hover:text-navy" onClick={() => void markAllNotificationsRead()}>
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-96 space-y-2 overflow-auto">
            {top.length ? (
              top.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    void markNotificationRead(item.id);
                    setOpen(false);
                    if (item.type.includes("budget")) navigate("/budget");
                    else if (item.type.includes("ai")) navigate("/insights");
                    else navigate("/");
                  }}
                  className={`w-full rounded-xl p-3 text-left ${item.read_at ? "bg-mist" : "bg-sage/70"}`}
                >
                  <p className="text-sm font-semibold text-ink">{item.title}</p>
                  <p className="text-xs text-ink/65">{item.body}</p>
                  <p className="mt-1 text-[11px] text-ink/50">{formatShortDate(item.created_at)}</p>
                </button>
              ))
            ) : (
              <p className="text-sm text-ink/60">No notifications yet.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
