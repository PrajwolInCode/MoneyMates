import { useAuth } from "../contexts/AuthContext";
import { useHousehold } from "../contexts/HouseholdContext";
import { supabaseUrlDomain } from "../lib/supabase";

export function DevDebugPanel() {
  const { user } = useAuth();
  const { household, expenses, budgetItems, dataWarnings, loadIssue } = useHousehold();

  if (!import.meta.env.DEV) return null;

  return (
    <aside className="fixed bottom-20 right-3 z-50 max-w-[calc(100vw-1.5rem)] rounded-xl border border-sage bg-white/95 p-3 text-xs text-ink/70 shadow-soft md:bottom-3">
      <p className="mb-1 font-bold text-ink">Dev data debug</p>
      <div className="grid gap-1">
        <span>User id: {user?.id ?? "none"}</span>
        <span>Email: {user?.email ?? "none"}</span>
        <span>Household id: {household?.id ?? "none"}</span>
        <span>Expenses loaded: {expenses.length}</span>
        <span>Budget items loaded: {budgetItems.length}</span>
        <span>Supabase domain: {supabaseUrlDomain}</span>
        <span>Load state: {loadIssue}</span>
        {dataWarnings.length ? <span>Warnings: {dataWarnings.join(" | ")}</span> : null}
      </div>
    </aside>
  );
}
