import { FormEvent, useEffect, useState } from "react";
import { Copy, LogOut, Save } from "lucide-react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { FormField } from "../components/FormField";
import { inputClass } from "../components/inputs";
import { PageHeader } from "../components/PageHeader";
import { Toast } from "../components/Toast";
import { WarningBanner } from "../components/WarningBanner";
import { useAuth } from "../contexts/AuthContext";
import { useHousehold } from "../contexts/HouseholdContext";
import { hasSupabaseEnv } from "../lib/supabase";

export function SettingsPage() {
  const { profile, updateProfile, signOut } = useAuth();
  const { household, isOwner } = useHousehold();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
  }, [profile?.display_name]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const handleProfile = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!displayName.trim()) {
      setError("Display name cannot be empty.");
      return;
    }
    setSaving(true);
    try {
      await updateProfile(displayName.trim());
      setToast("Profile updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update profile.");
    } finally {
      setSaving(false);
    }
  };

  const copyJoinCode = async () => {
    if (!household?.join_code) return;
    await navigator.clipboard.writeText(household.join_code);
    setToast("Join code copied.");
  };

  const handleSignOut = async () => {
    setLoggingOut(true);
    try {
      await signOut();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div>
      {toast ? <Toast message={toast} /> : null}
      <PageHeader title="Settings" description="Manage the details that keep your household budget easy to share and maintain." />

      {error ? (
        <div className="mb-4">
          <WarningBanner tone="strong">{error}</WarningBanner>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <h2 className="text-xl font-bold tracking-normal text-ink">Your profile</h2>
          <form className="mt-4 space-y-4" onSubmit={handleProfile}>
            <FormField label="Display name">
              <input className={inputClass} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </FormField>
            <p className="text-sm text-ink/60">Expenses show this name so both of you know who added each item.</p>
            <Button type="submit" loading={saving}>
              <Save className="h-4 w-4" aria-hidden="true" />
              Save profile
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="text-xl font-bold tracking-normal text-ink">Household</h2>
          <div className="mt-4 rounded-2xl bg-sage/50 p-4">
            <p className="text-sm font-medium text-ink/60">Name</p>
            <p className="mt-1 text-2xl font-bold tracking-normal text-ink">{household?.name}</p>
          </div>
          <div className="mt-3 rounded-2xl bg-sage/50 p-4">
            <p className="text-sm font-medium text-ink/60">Spouse join code</p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-mono text-2xl font-bold text-ink">{household?.join_code}</p>
              <Button variant="secondary" onClick={copyJoinCode}>
                <Copy className="h-4 w-4" aria-hidden="true" />
                Copy
              </Button>
            </div>
          </div>
          <p className="mt-3 text-sm text-ink/60">
            {isOwner ? "You can manage categories, limits, and recurring payments." : "You can add expenses and view the shared household plan."}
          </p>
        </Card>

        <Card>
          <h2 className="text-xl font-bold tracking-normal text-ink">Environment</h2>
          <div className="mt-4 space-y-3 text-sm text-ink/70">
            <div className="flex items-center justify-between rounded-2xl bg-sage/50 p-4">
              <span>Supabase frontend keys</span>
              <span className="font-semibold text-ink">{hasSupabaseEnv ? "Configured" : "Missing"}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-sage/50 p-4">
              <span>OpenAI key</span>
              <span className="font-semibold text-ink">Netlify only</span>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold tracking-normal text-ink">Session</h2>
          <p className="mt-2 text-sm leading-6 text-ink/65">MoneyMates keeps you logged in until you choose to log out.</p>
          <Button className="mt-4" variant="danger" loading={loggingOut} onClick={handleSignOut}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Log out
          </Button>
        </Card>
      </div>
    </div>
  );
}
