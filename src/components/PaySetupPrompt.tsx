import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useHousehold } from "../contexts/HouseholdContext";
import { PAY_FREQUENCY_OPTIONS } from "../lib/income";
import type { PayFrequency } from "../types";
import { Button } from "./Button";
import { Card } from "./Card";

const DISMISS_KEY = (householdId: string, userId: string) => `moneymates_pay_setup_dismissed_${householdId}_${userId}`;

export function PaySetupPrompt() {
  const { user } = useAuth();
  const { household, members, savePaySettings } = useHousehold();
  const member = useMemo(() => members.find((row) => row.user_id === user?.id) ?? null, [members, user?.id]);
  const [selection, setSelection] = useState<PayFrequency | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!household || !user) return;
    setDismissed(Boolean(window.localStorage.getItem(DISMISS_KEY(household.id, user.id))));
  }, [household?.id, user?.id]);

  if (!household || !user || !member || dismissed || member.pay_frequency) return null;

  const handleSave = async () => {
    if (!selection) {
      setError("Pick how often you get paid.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await savePaySettings({ frequency: selection });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save pay frequency.");
    } finally {
      setSaving(false);
    }
  };

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY(household.id, user.id), String(Date.now()));
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  return (
    <Card className="mb-5 border-mint/80 bg-gradient-to-br from-white via-white to-mint/40">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-mint p-2.5 text-moss">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-moss">Set up income reminders</p>
          <h2 className="mt-1 text-lg font-bold tracking-normal text-ink">How often do you get paid?</h2>
          <p className="mt-1 text-sm leading-6 text-ink/65">
            We'll nudge you each pay cycle so income stays current. Change it anytime in Settings.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {PAY_FREQUENCY_OPTIONS.map((option) => {
              const active = selection === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelection(option.value)}
                  className={`rounded-xl border px-3 py-3 text-left transition ${
                    active ? "border-navy bg-navy text-white shadow-soft" : "border-sage bg-white text-ink hover:border-moss"
                  }`}
                >
                  <p className="text-sm font-semibold">{option.label}</p>
                  <p className={`mt-0.5 text-xs ${active ? "text-white/75" : "text-ink/55"}`}>{option.helper}</p>
                </button>
              );
            })}
          </div>
          {error ? <p className="mt-3 text-sm font-medium text-coral">{error}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => void handleSave()} loading={saving} disabled={!selection}>
              Save
            </Button>
            <Button variant="ghost" onClick={handleDismiss}>
              Not now
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
