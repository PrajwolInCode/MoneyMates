import { Link, useLocation } from "react-router-dom";
import { Home, Lightbulb, ReceiptText, Settings, WalletCards } from "lucide-react";
import clsx from "clsx";

const items = [
  { label: "Home", href: "/", icon: Home },
  { label: "Spend", href: "/transactions", icon: ReceiptText },
  { label: "Budget", href: "/budget", icon: WalletCards },
  { label: "Coach", href: "/insights", icon: Lightbulb },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-sage/70 bg-white/95 backdrop-blur-xl md:hidden">
      <div className="scrollbar-none flex overflow-x-auto px-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.href || (item.href !== "/" && location.pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              to={item.href}
              className={clsx(
                "group flex min-w-[64px] flex-1 flex-col items-center gap-1 px-2 py-2.5 text-[11px] font-semibold transition-colors",
                active ? "text-navy" : "text-ink/45 hover:text-ink/70",
              )}
            >
              <span
                className={clsx(
                  "flex h-9 w-12 items-center justify-center rounded-xl transition-colors",
                  active ? "bg-mint text-navy" : "bg-transparent group-hover:bg-sage/50",
                )}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <span className="tracking-tightish">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function DesktopNav() {
  const location = useLocation();

  return (
    <nav className="hidden items-center gap-1 md:flex">
      {items.slice(0, -1).map((item) => {
        const active = location.pathname === item.href || (item.href !== "/" && location.pathname.startsWith(item.href));
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            to={item.href}
            className={clsx(
              "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
              active ? "bg-mint text-navy" : "text-ink/60 hover:bg-sage/50 hover:text-ink",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {item.label === "Home" ? "Dashboard" : item.label === "Spend" ? "Transactions" : item.label}
          </Link>
        );
      })}
      <Link
        to="/settings"
        aria-label="Settings"
        className={clsx(
          "rounded-xl p-2 transition-colors",
          location.pathname === "/settings" ? "bg-mint text-navy" : "text-ink/60 hover:bg-sage/50 hover:text-ink",
        )}
      >
        <Settings className="h-5 w-5" aria-hidden="true" />
      </Link>
    </nav>
  );
}
