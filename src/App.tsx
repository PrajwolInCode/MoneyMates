import { Link, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { DevDebugPanel } from "./components/DevDebugPanel";
import { LoadingState } from "./components/LoadingState";
import { useAuth } from "./contexts/AuthContext";
import { useHousehold } from "./contexts/HouseholdContext";
import { AddExpensePage } from "./pages/AddExpensePage";
import { AuthPage } from "./pages/AuthPage";
import { BudgetPage } from "./pages/BudgetPage";
import { DashboardPage } from "./pages/DashboardPage";
import { InsightsPage } from "./pages/InsightsPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";

function AuthRequired({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingState />;
  if (!user) return <Navigate to="/auth" replace />;
  return children;
}

function HouseholdRequired({ children }: { children: React.ReactNode }) {
  const { household, loading, error, loadIssue, refresh } = useHousehold();

  if (loading) return <LoadingState label="Opening your household budget" />;
  if (error) {
    const title =
      loadIssue === "missing_env"
        ? "Supabase connection is not configured"
        : loadIssue === "wrong_project"
          ? "Supabase project settings look wrong"
          : loadIssue === "network_error"
            ? "Supabase could not be reached"
            : loadIssue === "missing_table"
              ? "Supabase table is missing"
              : loadIssue === "missing_column"
                ? "Supabase column is missing"
        : loadIssue === "rls_denied"
          ? "Access denied by Supabase policies"
          : loadIssue === "schema_mismatch"
            ? "Supabase schema does not match the app"
            : "Household data failed to load";
    const detail =
      loadIssue === "missing_env"
        ? "Check Netlify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. The app only stores household data in Supabase."
        : loadIssue === "wrong_project"
          ? "Check that Netlify points at the same Supabase project that contains this household data."
          : loadIssue === "network_error"
            ? "Check the connection, then retry. No household data is stored in the browser."
            : loadIssue === "missing_table"
              ? "Run the documented Supabase migrations for this project. Existing household data is preserved."
              : loadIssue === "missing_column"
                ? "Run the planned budget items schema fix migration. Existing household data is preserved."
        : loadIssue === "rls_denied"
          ? "The logged-in user may not be a member of the household, or an RLS policy is blocking the read."
          : loadIssue === "schema_mismatch"
            ? "Run the documented Supabase migrations. Existing data is preserved; do not reset or recreate households."
            : "This can happen with a wrong Supabase project, network failure, or schema mismatch.";

    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <section className="w-full max-w-lg rounded-2xl border border-coral/30 bg-white p-5 shadow-soft">
          <p className="text-sm font-semibold text-coral">{title}</p>
          <h1 className="mt-2 text-2xl font-bold tracking-normal text-ink">Your existing data was not changed.</h1>
          <p className="mt-2 text-sm leading-6 text-ink/65">{detail}</p>
          <p className="mt-3 rounded-xl bg-mist px-3 py-2 text-xs text-ink/60">{error}</p>
          <button className="mt-4 rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white" onClick={() => void refresh()}>
            Retry loading
          </button>
        </section>
        <DevDebugPanel />
      </main>
    );
  }
  if (!household) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <section className="w-full max-w-lg rounded-2xl border border-sage bg-white p-5 shadow-soft">
          <p className="text-sm font-semibold text-moss">No household found</p>
          <h1 className="mt-2 text-2xl font-bold tracking-normal text-ink">This account is not linked to a household yet.</h1>
          <p className="mt-2 text-sm leading-6 text-ink/65">
            Join an existing household with its code, or create a new one only if this account has no existing household.
          </p>
          <Link className="mt-4 inline-flex rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white" to="/onboarding">
            Open setup
          </Link>
        </section>
        <DevDebugPanel />
      </main>
    );
  }
  return children;
}

function ProtectedApp() {
  return (
    <AuthRequired>
      <HouseholdRequired>
        <AppLayout />
      </HouseholdRequired>
    </AuthRequired>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route
        path="/onboarding"
        element={
          <AuthRequired>
            <OnboardingPage />
          </AuthRequired>
        }
      />
      <Route element={<ProtectedApp />}>
        <Route index element={<DashboardPage />} />
        <Route path="/add" element={<AddExpensePage />} />
        <Route path="/budget" element={<BudgetPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
