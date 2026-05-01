import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { UsersRound } from "lucide-react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { FormField } from "../components/FormField";
import { inputClass } from "../components/inputs";
import { WarningBanner } from "../components/WarningBanner";
import { useHousehold } from "../contexts/HouseholdContext";

export function OnboardingPage() {
  const navigate = useNavigate();
  const { household, createHousehold, joinHousehold } = useHousehold();
  const [householdName, setHouseholdName] = useState("Praj household");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<"create" | "join" | null>(null);

  if (household) return <Navigate to="/" replace />;

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!householdName.trim()) {
      setError("Give your household a simple name.");
      return;
    }
    setLoadingAction("create");
    try {
      await createHousehold(householdName.trim());
      navigate("/", { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create household.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleJoin = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (joinCode.trim().length < 6) {
      setError("Enter the join code from your spouse.");
      return;
    }
    setLoadingAction("join");
    try {
      await joinHousehold(joinCode.trim().toUpperCase());
      navigate("/", { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not join household.");
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-navy text-white shadow-soft">
            <UsersRound className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold tracking-normal text-ink">Set up your household</h1>
          <p className="mt-2 text-sm leading-6 text-ink/65">Create the shared space once, then invite your spouse with the join code.</p>
        </div>

        {error ? (
          <div className="mb-4">
            <WarningBanner tone="strong">{error}</WarningBanner>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <h2 className="text-xl font-bold tracking-normal text-ink">Create household</h2>
            <p className="mt-1 text-sm text-ink/60">Start the May 2026 budget and invite your spouse after setup.</p>
            <form className="mt-5 space-y-4" onSubmit={handleCreate}>
              <FormField label="Household name">
                <input className={inputClass} value={householdName} onChange={(event) => setHouseholdName(event.target.value)} />
              </FormField>
              <Button type="submit" className="w-full" loading={loadingAction === "create"}>
                Create household
              </Button>
            </form>
          </Card>

          <Card>
            <h2 className="text-xl font-bold tracking-normal text-ink">Join household</h2>
            <p className="mt-1 text-sm text-ink/60">Use the simple code your spouse sees in Settings.</p>
            <form className="mt-5 space-y-4" onSubmit={handleJoin}>
              <FormField label="Join code">
                <input
                  className={`${inputClass} uppercase`}
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value)}
                  placeholder="ABCD1234"
                />
              </FormField>
              <Button type="submit" variant="secondary" className="w-full" loading={loadingAction === "join"}>
                Join household
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </main>
  );
}
