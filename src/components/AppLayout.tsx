import { Outlet } from "react-router-dom";
import { CircleDollarSign } from "lucide-react";
import { useHousehold } from "../contexts/HouseholdContext";
import { BottomNav, DesktopNav } from "./BottomNav";

export function AppLayout() {
  const { household } = useHousehold();

  return (
    <div className="min-h-screen pb-24 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-white/70 bg-mist/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-navy text-white shadow-soft">
              <CircleDollarSign className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-normal text-ink">MoneyMates</p>
              <p className="text-xs font-medium text-ink/55">{household?.name ?? "Household budget"}</p>
            </div>
          </div>
          <DesktopNav />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:py-8">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}
