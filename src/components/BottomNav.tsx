import { Link, useLocation } from "react-router-dom";
import { Home, Lightbulb, Plus, Settings, WalletCards } from "lucide-react";
import clsx from "clsx";

const items = [
  { label: "Home", href: "/", icon: Home },
  { label: "Add", href: "/add", icon: Plus },
  { label: "Budget", href: "/budget", icon: WalletCards },
  { label: "Coach", href: "/insights", icon: Lightbulb },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-sage bg-white/95 backdrop-blur md:hidden">
      <div className="scrollbar-none flex overflow-x-auto px-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={clsx(
                "flex min-w-[68px] flex-1 flex-col items-center gap-1 px-2 py-3 text-[11px] font-semibold",
                active ? "text-navy" : "text-ink/50",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {item.label}
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
        const active = location.pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            to={item.href}
            className={clsx(
              "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold",
              active ? "bg-sage text-navy" : "text-ink/60 hover:bg-sage/60",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {item.label === "Home" ? "Dashboard" : item.label}
          </Link>
        );
      })}
      <Link
        to="/settings"
        aria-label="Settings"
        className={clsx("rounded-xl p-2", location.pathname === "/settings" ? "bg-sage text-navy" : "text-ink/60 hover:bg-sage/60")}
      >
        <Settings className="h-5 w-5" aria-hidden="true" />
      </Link>
    </nav>
  );
}
