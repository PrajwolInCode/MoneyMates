import { FormEvent, useEffect, useState } from "react";
import { Bell, Copy, Download, LogOut, Mail, Save, Trash2 } from "lucide-react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { FixAppCacheButton } from "../components/FixAppCacheButton";
import { FormField } from "../components/FormField";
import { inputClass } from "../components/inputs";
import { PageHeader } from "../components/PageHeader";
import { RefreshDataButton } from "../components/RefreshDataButton";
import { Toast } from "../components/Toast";
import { WarningBanner } from "../components/WarningBanner";
import { useAuth } from "../contexts/AuthContext";
import { useHousehold } from "../contexts/HouseholdContext";
import { formatMonthLabel } from "../lib/date";
import { exportSummaryPdf, exportTransactionsCsv, exportTransactionsExcel } from "../lib/export";
import { disablePhonePush, enablePhonePush, getPhonePushSupportMessage, hasPhonePushSubscription } from "../lib/pushNotifications";
import { hasSupabaseEnv, supabaseUrlDomain } from "../lib/supabase";
import { supabase } from "../lib/supabase";

export function SettingsPage() {
  const { user, profile, updateProfile, signOut } = useAuth();
  const { household, isOwner, expenses, categories, budgetItems, notifications, monthStart, budgetMonth, budgetLimits, members, aiInsight } = useHousehold();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [phonePushEnabled, setPhonePushEnabled] = useState(false);
  const [phonePushBusy, setPhonePushBusy] = useState(false);
  const [phonePushMessage, setPhonePushMessage] = useState<string | null>(getPhonePushSupportMessage());
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [deleteAcknowledged, setDeleteAcknowledged] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [previousMonth, setPreviousMonth] = useState("");
  const [previousMode, setPreviousMode] = useState("summary");
  const [previousIncome, setPreviousIncome] = useState("");
  const [previousExpense, setPreviousExpense] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [previousNotes, setPreviousNotes] = useState("");

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
  }, [profile?.display_name]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    let mounted = true;
    setPhonePushMessage(getPhonePushSupportMessage());
    hasPhonePushSubscription()
      .then((enabled) => {
        if (mounted) setPhonePushEnabled(enabled);
      })
      .catch(() => {
        if (mounted) setPhonePushEnabled(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

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

  const handleEnablePhonePush = async () => {
    if (!user) return;
    setPhonePushBusy(true);
    setError(null);
    try {
      const result = await enablePhonePush(user.id);
      setPhonePushEnabled(result.enabled);
      setPhonePushMessage(result.message);
      setToast(result.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not enable phone notifications.");
    } finally {
      setPhonePushBusy(false);
    }
  };

  const handleDisablePhonePush = async () => {
    if (!user) return;
    setPhonePushBusy(true);
    setError(null);
    try {
      const result = await disablePhonePush(user.id);
      setPhonePushEnabled(result.enabled);
      setPhonePushMessage(result.message);
      setToast(result.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not disable phone notifications.");
    } finally {
      setPhonePushBusy(false);
    }
  };

  const exportBase = `moneymates-${formatMonthLabel(monthStart).toLowerCase().replaceAll(" ", "-")}`;
  const deletionUnlocked = deleteAcknowledged && deleteText === "DELETE";
  const supportEmail = "prajwol.subedi@hotmail.com";
  const supportMessage = [
    "Hi Prajwol,",
    "",
    "MoneyMates has been useful for me, and I would like to support the work behind it.",
    "",
    "Please send me the best payment option.",
    "",
    "Thanks.",
  ].join("\n");
  const supportMailTo = `mailto:${supportEmail}?subject=${encodeURIComponent("Supporting MoneyMates")}&body=${encodeURIComponent(supportMessage)}`;

  const copySupportMessage = async () => {
    await navigator.clipboard.writeText(supportMessage);
    setToast("Support message copied.");
  };

  const handlePreviousMonth = async (event: FormEvent) => {
    event.preventDefault();
    if (!household || !previousMonth) return;
    setSaving(true);
    setError(null);
    try {
      const monthStartValue = `${previousMonth}-01`;
      const { error: previousError } = await supabase.from("budget_months").upsert(
        {
          household_id: household.id,
          month_start: monthStartValue,
          total_income: Number(previousIncome || 0),
          planned_budget: Number(previousExpense || 0),
          opening_balance: Number(openingBalance || 0),
          actual_expense: Number(previousExpense || 0),
          import_mode: previousMode,
          notes: previousNotes.trim() || null,
        },
        { onConflict: "household_id,month_start" },
      );
      if (previousError) throw previousError;
      setToast("Previous month data saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save previous month data.");
    } finally {
      setSaving(false);
    }
  };

  const requireDeleteConfirmation = () => {
    if (!deletionUnlocked) {
      setError("Tick the checkbox and type DELETE before using a deletion action.");
      return false;
    }
    return true;
  };

  const handleDeletePersonalData = async () => {
    if (!household || !user || !requireDeleteConfirmation()) return;
    setError(null);
    setSaving(true);
    try {
      const results = await Promise.allSettled([
        supabase.from("expenses").delete().eq("household_id", household.id).eq("user_id", user.id),
        supabase.from("planned_budget_items").delete().eq("household_id", household.id).or(`created_by.eq.${user.id},owner_user_id.eq.${user.id}`),
        supabase.from("budget_items").delete().eq("household_id", household.id).or(`created_by.eq.${user.id},owner_user_id.eq.${user.id}`),
      ]);
      const failed = results.find((result) => result.status === "fulfilled" && result.value.error && result.value.error.code !== "42P01");
      if (failed?.status === "fulfilled" && failed.value.error) throw failed.value.error;
      setToast("Your personal data deletion was requested.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete personal data.");
    } finally {
      setSaving(false);
    }
  };

  const handleLeaveHousehold = async () => {
    if (!household || !user || !requireDeleteConfirmation()) return;
    setSaving(true);
    setError(null);
    try {
      const { error: leaveError } = await supabase.from("household_members").delete().eq("household_id", household.id).eq("user_id", user.id);
      if (leaveError) throw leaveError;
      setToast("You left the household.");
      window.location.assign("/onboarding");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not leave household.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHousehold = async () => {
    if (!household || !isOwner || !requireDeleteConfirmation()) return;
    setSaving(true);
    setError(null);
    try {
      const { error: deleteError } = await supabase.from("households").delete().eq("id", household.id).eq("owner_id", user?.id);
      if (deleteError) throw deleteError;
      setToast("Household deletion was requested.");
      window.location.assign("/onboarding");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete household.");
    } finally {
      setSaving(false);
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
            <p className="text-sm text-ink/60">Expenses show this name so household members know who added each item.</p>
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
            <p className="text-sm font-medium text-ink/60">Household join code</p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-mono text-2xl font-bold text-ink">{household?.join_code}</p>
              <Button variant="secondary" onClick={copyJoinCode}>
                <Copy className="h-4 w-4" aria-hidden="true" />
                Copy
              </Button>
            </div>
          </div>
          <p className="mt-3 text-sm text-ink/60">
            {isOwner
              ? "You can manage household settings. All members can add expenses and budget items."
              : "You can add expenses, manage budget items, and view the shared household plan."}
          </p>
        </Card>

        <Card>
          <h2 className="text-xl font-bold tracking-normal text-ink">Notifications</h2>
          <div className="mt-4 rounded-2xl bg-sage/50 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-white p-2 text-moss">
                <Bell className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-ink">Phone push</p>
                <p className="mt-1 text-sm leading-6 text-ink/65">
                  In-app notifications stay on for household activity. Phone push is optional and must be enabled on each device.
                </p>
              </div>
            </div>
            {phonePushMessage ? <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm text-ink/65">{phonePushMessage}</p> : null}
            <Button
              className="mt-4"
              variant={phonePushEnabled ? "danger" : "secondary"}
              loading={phonePushBusy}
              disabled={!phonePushEnabled && Boolean(getPhonePushSupportMessage())}
              onClick={phonePushEnabled ? handleDisablePhonePush : handleEnablePhonePush}
            >
              {phonePushEnabled ? "Disable phone push" : "Enable phone push"}
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold tracking-normal text-ink">Account/Data</h2>
          <p className="mt-2 text-sm leading-6 text-ink/65">Reload your session, household membership, and household data from Supabase.</p>
          <RefreshDataButton className="mt-4 w-full sm:w-auto" />
          <form className="mt-5 rounded-2xl bg-sage/50 p-4" onSubmit={handlePreviousMonth}>
            <p className="font-semibold text-ink">Add previous month data</p>
            <p className="mt-1 text-sm leading-6 text-ink/65">Add an opening balance, last month income, expenses, or carried-over money as a historical summary.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <FormField label="Month/year">
                <input className={inputClass} type="month" value={previousMonth} onChange={(event) => setPreviousMonth(event.target.value)} />
              </FormField>
              <FormField label="Import as">
                <select className={inputClass} value={previousMode} onChange={(event) => setPreviousMode(event.target.value)}>
                  <option value="summary">Summary</option>
                  <option value="detailed_items">Detailed items</option>
                </select>
              </FormField>
              <FormField label="Opening balance">
                <input className={inputClass} inputMode="decimal" value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} placeholder="0.00" />
              </FormField>
              <FormField label="Income">
                <input className={inputClass} inputMode="decimal" value={previousIncome} onChange={(event) => setPreviousIncome(event.target.value)} placeholder="0.00" />
              </FormField>
              <FormField label="Expense">
                <input className={inputClass} inputMode="decimal" value={previousExpense} onChange={(event) => setPreviousExpense(event.target.value)} placeholder="0.00" />
              </FormField>
              <FormField label="Notes">
                <input className={inputClass} value={previousNotes} onChange={(event) => setPreviousNotes(event.target.value)} placeholder="Savings carried over, last month balance" />
              </FormField>
            </div>
            <Button className="mt-3" type="submit" variant="secondary" loading={saving} disabled={!previousMonth}>
              Save previous month data
            </Button>
          </form>
          <div className="mt-5 rounded-2xl bg-sage/50 p-4">
            <p className="font-semibold text-ink">Download my data</p>
            <p className="mt-1 text-sm leading-6 text-ink/65">Export the selected month before making account or household changes.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <Button variant="secondary" onClick={() => exportTransactionsCsv(`${exportBase}-transactions.csv`, expenses)}>
                <Download className="h-4 w-4" aria-hidden="true" />
                CSV
              </Button>
              <Button variant="secondary" onClick={() => void exportTransactionsExcel(`${exportBase}-transactions.xlsx`, expenses)}>
                Excel
              </Button>
              <Button
                variant="secondary"
                disabled={!household}
                onClick={() =>
                  household
                    ? void exportSummaryPdf({
                        filename: `${exportBase}-summary.pdf`,
                        household,
                        monthLabel: formatMonthLabel(monthStart),
                        budgetMonth,
                        budgetItems,
                        categories,
                        limits: budgetLimits,
                        expenses,
                        members,
                        aiInsight,
                      })
                    : undefined
                }
              >
                PDF
              </Button>
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-coral/30 bg-coral/5 p-4">
            <div className="flex items-start gap-3">
              <Trash2 className="mt-1 h-5 w-5 text-coral" aria-hidden="true" />
              <div>
                <p className="font-semibold text-ink">Delete/export data</p>
                <p className="mt-1 text-sm leading-6 text-ink/65">
                  Do you want to download your data before deleting? Deleting personal data, leaving a household, or deleting a household requires confirmation.
                </p>
              </div>
            </div>
            <label className="mt-3 flex items-start gap-2 text-sm text-ink/75">
              <input className="mt-1" type="checkbox" checked={deleteAcknowledged} onChange={(event) => setDeleteAcknowledged(event.target.checked)} />
              I understand this cannot be undone.
            </label>
            <FormField label="Type DELETE to unlock destructive actions">
              <input className={inputClass} value={deleteText} onChange={(event) => setDeleteText(event.target.value)} placeholder="DELETE" />
            </FormField>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <Button variant="danger" disabled={!deletionUnlocked || saving} onClick={() => void handleDeletePersonalData()}>Delete my personal data</Button>
              <Button variant="danger" disabled={!deletionUnlocked || saving} onClick={() => void handleLeaveHousehold()}>Leave household</Button>
              <Button variant="danger" disabled={!deletionUnlocked || !isOwner || saving} onClick={() => void handleDeleteHousehold()}>Delete household</Button>
            </div>
            <p className="mt-2 text-xs leading-5 text-ink/60">
              Members can delete their own personal items and expenses. Owner-only household deletion must clearly remove shared household data after confirmation.
            </p>
          </div>
          <div className="mt-5 rounded-2xl bg-sage/50 p-4">
            <p className="font-semibold text-ink">Fix app loading issue</p>
            <p className="mt-1 text-sm leading-6 text-ink/65">
              Use this if MoneyMates opens but shows a blank page or old version. This only clears local app cache on this device. Your Supabase data is safe.
            </p>
            <FixAppCacheButton />
          </div>
        </Card>

        {user ? (
          <Card>
            <h2 className="text-xl font-bold tracking-normal text-ink">Data connection</h2>
            <div className="mt-4 grid gap-3 text-sm text-ink/70 sm:grid-cols-2">
              <div className="rounded-2xl bg-sage/50 p-4">
                <p className="font-medium text-ink/55">Logged-in email</p>
                <p className="mt-1 break-words font-semibold text-ink">{user.email ?? "Unknown"}</p>
              </div>
              <div className="rounded-2xl bg-sage/50 p-4">
                <p className="font-medium text-ink/55">User ID</p>
                <p className="mt-1 break-all font-mono text-xs text-ink">{user.id}</p>
              </div>
              <div className="rounded-2xl bg-sage/50 p-4">
                <p className="font-medium text-ink/55">Current household name</p>
                <p className="mt-1 font-semibold text-ink">{household?.name ?? "None"}</p>
              </div>
              <div className="rounded-2xl bg-sage/50 p-4">
                <p className="font-medium text-ink/55">Current household ID</p>
                <p className="mt-1 break-all font-mono text-xs text-ink">{household?.id ?? "None"}</p>
              </div>
              <div className="rounded-2xl bg-sage/50 p-4">
                <p className="font-medium text-ink/55">Expenses loaded</p>
                <p className="mt-1 text-2xl font-bold text-ink">{expenses.length}</p>
              </div>
              <div className="rounded-2xl bg-sage/50 p-4">
                <p className="font-medium text-ink/55">Categories loaded</p>
                <p className="mt-1 text-2xl font-bold text-ink">{categories.length}</p>
              </div>
              <div className="rounded-2xl bg-sage/50 p-4">
                <p className="font-medium text-ink/55">Budget items loaded</p>
                <p className="mt-1 text-2xl font-bold text-ink">{budgetItems.length}</p>
              </div>
              <div className="rounded-2xl bg-sage/50 p-4">
                <p className="font-medium text-ink/55">Notifications loaded</p>
                <p className="mt-1 text-2xl font-bold text-ink">{notifications.length}</p>
              </div>
              <div className="rounded-2xl bg-sage/50 p-4">
                <p className="font-medium text-ink/55">Supabase project domain</p>
                <p className="mt-1 break-words font-semibold text-ink">{supabaseUrlDomain}</p>
              </div>
              <div className="rounded-2xl bg-sage/50 p-4">
                <p className="font-medium text-ink/55">Current selected month</p>
                <p className="mt-1 font-semibold text-ink">{formatMonthLabel(monthStart)}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              {!hasSupabaseEnv ? <p className="rounded-xl bg-coral/10 px-3 py-2 font-semibold text-coral">Supabase connection missing</p> : null}
              {!household ? <p className="rounded-xl bg-coral/10 px-3 py-2 font-semibold text-coral">No household found for this account</p> : null}
              {user && !household ? <p className="rounded-xl bg-coral/10 px-3 py-2 font-semibold text-coral">You are logged in but not linked to a household</p> : null}
              {hasSupabaseEnv && household ? <p className="rounded-xl bg-mint px-3 py-2 font-semibold text-moss">Data loaded successfully</p> : null}
              {household && expenses.length === 0 ? <p className="rounded-xl bg-sage/50 px-3 py-2 font-semibold text-ink">No expenses found for selected month</p> : null}
            </div>
          </Card>
        ) : null}

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

        <Card>
          <h2 className="text-xl font-bold tracking-normal text-ink">Support MoneyMates</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/65">
            If MoneyMates helps you plan your month, a small contribution helps keep the app improving. Email me and I will send the best payment option.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-ink focus:outline-none focus:ring-2 focus:ring-navy/25"
              href={supportMailTo}
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              Email to support
            </a>
            <Button variant="secondary" onClick={() => void copySupportMessage()}>
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copy message
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
