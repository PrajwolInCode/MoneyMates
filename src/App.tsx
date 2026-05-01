import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
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
  const { household, loading } = useHousehold();

  if (loading) return <LoadingState label="Opening your household budget" />;
  if (!household) return <Navigate to="/onboarding" replace />;
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
