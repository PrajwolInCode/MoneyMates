import { Outlet } from "react-router-dom";
import { CircleDollarSign } from "lucide-react";
import { useHousehold } from "../contexts/HouseholdContext";
import { BottomNav, DesktopNav } from "./BottomNav";
import { DevDebugPanel } from "./DevDebugPanel";
import { MobilePullToRefresh } from "./MobilePullToRefresh";
import { MoneyCheckInPrompt } from "./MoneyCheckInPrompt";
import { NotificationCenter } from "./NotificationCenter";
import { WarningBanner } from "./WarningBanner";

export function AppLayout() {
  const { household, dataWarnings } = useHousehold();

  return (
    <div className="min-h-screen pb-24 md:pb-0">
      <MobilePullToRefresh />
      <header className="sticky top-0 z-30 border-b border-sage/50 bg-mist/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-navy to-ink text-white shadow-elevated">
              <CircleDollarSign className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold tracking-tightish text-ink">MoneyMates</p>
              <p className="truncate text-[11px] font-medium uppercase tracking-[0.12em] text-ink/45">
                {household?.name ?? "Household budget"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5"><DesktopNav /><NotificationCenter /></div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-9">
        {dataWarnings.length ? (
          <div className="mb-5">
            <WarningBanner>{dataWarnings.join(" ")}</WarningBanner>
          </div>
        ) : null}
        <Outlet />
      </main>

      <MoneyCheckInPrompt />
      <BottomNav />
      <DevDebugPanel />
    </div>
  );
}
