import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { CircleDollarSign } from "lucide-react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { FormField } from "../components/FormField";
import { inputClass } from "../components/inputs";
import { LoadingState } from "../components/LoadingState";
import { WarningBanner } from "../components/WarningBanner";
import { useAuth } from "../contexts/AuthContext";
import { hasSupabaseEnv } from "../lib/supabase";

function authErrorMessage(caught: unknown) {
  const message = caught instanceof Error ? caught.message : "";
  const normalized = message.toLowerCase();

  if (normalized.includes("email rate") || normalized.includes("rate limit") || normalized.includes("email create")) {
    return "Supabase has reached its built-in auth email limit. For private sharing, turn off email confirmation in Supabase Auth > Providers > Email, or configure Custom SMTP for production signups.";
  }

  if (normalized.includes("email address not authorized")) {
    return "Supabase's default email sender only sends to project team emails. Configure Custom SMTP, or add this person to the Supabase organization while testing.";
  }

  return message || "Authentication failed.";
}

export function AuthPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <LoadingState />;
  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }
    if (password.length < 6) {
      setError("Use at least 6 characters for your password.");
      return;
    }
    if (mode === "signup" && !displayName.trim()) {
      setError("Enter the name you want shown on expenses.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signin") {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password, displayName.trim());
        setNotice("Account created. If email confirmation is enabled, check your inbox before signing in.");
      }
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-navy text-white shadow-soft">
            <CircleDollarSign className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold tracking-normal text-ink">MoneyMates</h1>
          <p className="mt-2 text-sm leading-6 text-ink/65">A calm place for both of you to track the household plan.</p>
        </div>

        <Card>
          <div className="mb-5 grid grid-cols-2 rounded-xl bg-sage/60 p-1">
            <button
              type="button"
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${mode === "signin" ? "bg-white text-navy shadow-sm" : "text-ink/60"}`}
              onClick={() => setMode("signin")}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${mode === "signup" ? "bg-white text-navy shadow-sm" : "text-ink/60"}`}
              onClick={() => setMode("signup")}
            >
              Sign up
            </button>
          </div>

          {!hasSupabaseEnv ? (
            <div className="mb-4">
              <WarningBanner tone="strong">Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before using login.</WarningBanner>
            </div>
          ) : null}

          <form className="space-y-4" onSubmit={handleSubmit}>
            {mode === "signup" ? (
              <FormField label="Display name">
                <input className={inputClass} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Praj" />
              </FormField>
            ) : null}

            <FormField label="Email">
              <input className={inputClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
            </FormField>

            <FormField label="Password">
              <input className={inputClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </FormField>

            {error ? <WarningBanner tone="strong">{error}</WarningBanner> : null}
            {notice ? <WarningBanner>{notice}</WarningBanner> : null}

            <Button type="submit" className="w-full" loading={submitting}>
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
