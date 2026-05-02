import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, Copy, Home, Share2, Sparkles, UsersRound, WalletCards } from "lucide-react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { FormField } from "../components/FormField";
import { inputClass } from "../components/inputs";
import { LoadingState } from "../components/LoadingState";
import { WarningBanner } from "../components/WarningBanner";
import { useAuth } from "../contexts/AuthContext";
import { useHousehold } from "../contexts/HouseholdContext";
import { monthlyAmountForBudgetItem, totalBudgetItemMonthlyIncome, totalBudgetItemMonthlyPlannedExpenses } from "../lib/budget";
import { currency } from "../lib/format";
import {
  buildOnboardingHelperPayload,
  ONBOARDING_TEMPLATES,
  requestOnboardingBudgetHelper,
  SHARED_EXPENSE_TEMPLATE,
  suggestMissingBudgetItems,
  type BudgetOnboardingTemplate,
  type OnboardingSuggestion,
} from "../lib/onboardingBudget";
import type { BudgetFrequency, BudgetItemKind, BudgetItemScope, BudgetItemType } from "../types";

type LoadingAction = "create" | "join" | "save" | "ai" | "complete" | null;

type BudgetDraft = {
  itemName: string;
  category: string;
  type: BudgetItemType;
  amount: string;
  frequency: BudgetFrequency;
  budgetKind: BudgetItemKind;
  itemScope: BudgetItemScope;
  notes: string;
};

const FREQUENCY_OPTIONS: Array<{ value: BudgetFrequency; label: string }> = [
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "one_time", label: "One time" },
  { value: "unknown", label: "Unknown" },
];

const CATEGORY_OPTIONS = [
  "Income",
  "Direct debits",
  "Bills",
  "Debt",
  "Savings",
  "Personal spending",
  "Shared household",
  "Housing",
  "Utilities",
  "Transport",
  "Insurance",
  "Phone",
  "Food",
  "Other",
];

function normalizeJoinCode(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function joinErrorMessage(caught: unknown) {
  const message = caught instanceof Error ? caught.message : "";
  if (message.toLowerCase().includes("invalid join code")) {
    return "That household key was not found. Check the key and try again.";
  }
  if (message.toLowerCase().includes("not authenticated")) {
    return "Please sign in again before joining the household.";
  }
  return message || "Could not join household.";
}

function draftFromTemplate(template: BudgetOnboardingTemplate): BudgetDraft {
  return {
    itemName: template.itemName,
    category: template.category,
    type: template.type,
    amount: "",
    frequency: template.frequency,
    budgetKind: template.budgetKind,
    itemScope: template.itemScope,
    notes: "",
  };
}

function draftFromSuggestion(suggestion: OnboardingSuggestion): BudgetDraft {
  return {
    itemName: suggestion.itemName,
    category: suggestion.category,
    type: suggestion.type,
    amount: "",
    frequency: suggestion.frequency,
    budgetKind: suggestion.budgetKind,
    itemScope: suggestion.itemScope,
    notes: suggestion.reason,
  };
}

function labelForKind(kind: BudgetItemKind) {
  return ONBOARDING_TEMPLATES.find((template) => template.budgetKind === kind)?.label ?? (kind === "shared_expense" ? "Shared expense" : "Budget item");
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { household, members, budgetItems, isOwner, loading, createHousehold, joinHousehold, saveBudgetItem, completeBudgetSetup } = useHousehold();
  const [householdName, setHouseholdName] = useState("Our household");
  const [joinCode, setJoinCode] = useState("");
  const [inviteDismissed, setInviteDismissed] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<BudgetOnboardingTemplate>(ONBOARDING_TEMPLATES[0]);
  const [draft, setDraft] = useState<BudgetDraft>(() => draftFromTemplate(ONBOARDING_TEMPLATES[0]));
  const [suggestions, setSuggestions] = useState<OnboardingSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);

  const currentUserItems = useMemo(
    () => budgetItems.filter((item) => item.created_by === user?.id && !item.archived_at),
    [budgetItems, user?.id],
  );
  const currentMember = members.find((member) => member.user_id === user?.id);
  const otherMembers = members.filter((member) => member.user_id !== user?.id);
  const otherMembersWithData = otherMembers.filter((member) => budgetItems.some((item) => item.created_by === member.user_id && !item.archived_at));
  const monthlyIncome = totalBudgetItemMonthlyIncome(currentUserItems);
  const monthlyPlanned = totalBudgetItemMonthlyPlannedExpenses(currentUserItems);
  const showInviteStep = Boolean(household && isOwner && !inviteDismissed && members.length <= 1 && currentUserItems.length === 0);
  const completedOwnPart = Boolean(currentMember?.budget_setup_completed_at || currentUserItems.length > 0);
  const userLabel = profile?.display_name || user?.email || "you";

  if (loading && !household) return <LoadingState label="Opening setup" />;

  const progressSteps = [
    { label: "Sign up", done: Boolean(user), active: !user },
    { label: "Household", done: Boolean(household), active: Boolean(user && !household) },
    { label: "Invite", done: Boolean(household && (!isOwner || members.length > 1 || inviteDismissed || currentUserItems.length > 0)), active: showInviteStep },
    { label: "Your part", done: completedOwnPart, active: Boolean(household && !showInviteStep) },
    { label: "Check", done: Boolean(currentMember?.budget_setup_completed_at), active: Boolean(currentUserItems.length > 0) },
    { label: "Dashboard", done: false, active: false },
  ];

  const startTemplate = (template: BudgetOnboardingTemplate) => {
    setActiveTemplate(template);
    setDraft(draftFromTemplate(template));
    setError(null);
    setNotice(null);
  };

  const startSuggestion = (suggestion: OnboardingSuggestion) => {
    setActiveTemplate({
      budgetKind: suggestion.budgetKind,
      label: labelForKind(suggestion.budgetKind),
      title: `Add ${suggestion.itemName}`,
      description: suggestion.reason,
      examples: [suggestion.itemName],
      itemName: suggestion.itemName,
      category: suggestion.category,
      type: suggestion.type,
      frequency: suggestion.frequency,
      itemScope: suggestion.itemScope,
    });
    setDraft(draftFromSuggestion(suggestion));
    setNotice("Suggestion loaded. Add an amount if you know it, or leave it blank for later.");
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!householdName.trim()) {
      setError("Give your household a simple name.");
      return;
    }
    setLoadingAction("create");
    try {
      await createHousehold(householdName.trim());
      setInviteDismissed(false);
      setNotice("Household created. Share the household key when you are ready.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create household.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleJoin = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const normalizedCode = normalizeJoinCode(joinCode);
    if (normalizedCode.length < 6) {
      setError("Enter the household key.");
      return;
    }
    setLoadingAction("join");
    try {
      await joinHousehold(normalizedCode);
      setInviteDismissed(true);
      setNotice("Household joined. Add your part when you are ready.");
    } catch (caught) {
      setError(joinErrorMessage(caught));
    } finally {
      setLoadingAction(null);
    }
  };

  const copyHouseholdKey = async () => {
    if (!household?.join_code) return;
    await navigator.clipboard.writeText(household.join_code);
    setNotice("Household key copied.");
  };

  const shareHouseholdKey = async () => {
    if (!household?.join_code) return;
    const text = `Join my MoneyMates household with this key: ${household.join_code}`;
    if (navigator.share) {
      await navigator.share({ title: "MoneyMates household key", text });
      return;
    }
    await navigator.clipboard.writeText(text);
    setNotice("Share text copied.");
  };

  const handleBudgetItem = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const itemName = draft.itemName.trim();
    const category = draft.category.trim();
    const parsedAmount = draft.amount.trim() ? Number(draft.amount) : null;

    if (!itemName) {
      setError("Enter a name for this budget item.");
      return;
    }
    if (!category) {
      setError("Choose a category.");
      return;
    }
    if (parsedAmount !== null && (!Number.isFinite(parsedAmount) || parsedAmount < 0)) {
      setError("Amount must be zero or greater, or left blank for later.");
      return;
    }

    setLoadingAction("save");
    try {
      await saveBudgetItem({
        item_name: itemName,
        category,
        type: draft.type,
        amount: parsedAmount,
        frequency: draft.frequency,
        quantity: 1,
        item_scope: draft.itemScope,
        budget_kind: draft.budgetKind,
        start_date: null,
        notes: draft.notes.trim() || null,
        needs_amount: parsedAmount === null,
        is_active: true,
      });
      setNotice(`${itemName} added to your part of the budget.`);
      setDraft(draftFromTemplate(activeTemplate));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save budget item.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAskAi = async () => {
    const payload = buildOnboardingHelperPayload(currentUserItems);
    const localSuggestions = suggestMissingBudgetItems(payload);
    setError(null);
    setNotice(null);
    setLoadingAction("ai");
    try {
      const aiSuggestions = await requestOnboardingBudgetHelper(payload);
      setSuggestions(aiSuggestions.length ? aiSuggestions : localSuggestions);
      setNotice("The helper suggested a few categories to check. Keep only what fits your household.");
    } catch {
      setSuggestions(localSuggestions);
      setNotice("The helper suggested a few categories to check. Keep only what fits your household.");
    } finally {
      setLoadingAction(null);
    }
  };

  const continueToDashboard = async () => {
    setError(null);
    setLoadingAction("complete");
    try {
      await completeBudgetSetup();
      navigate("/", { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not finish setup.");
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <main className="min-h-screen px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-navy text-white shadow-soft">
            <UsersRound className="h-7 w-7" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-moss">Guided setup</p>
          <h1 className="mt-1 text-3xl font-bold tracking-normal text-ink">Build your household money plan</h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-ink/65">
            Add your own income, bills, repayments, spending, and goals. MoneyMates combines each member&apos;s part into one household budget.
          </p>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {progressSteps.map((step, index) => (
            <div
              key={step.label}
              className={`rounded-xl border px-2 py-2 text-center text-xs font-semibold ${
                step.done ? "border-moss bg-mint text-moss" : step.active ? "border-navy bg-white text-navy" : "border-sage bg-white/70 text-ink/45"
              }`}
            >
              <span className="block text-[11px] opacity-70">Step {index + 1}</span>
              {step.label}
            </div>
          ))}
        </div>

        {error ? (
          <div className="mb-4">
            <WarningBanner tone="strong">{error}</WarningBanner>
          </div>
        ) : null}
        {notice ? (
          <div className="mb-4">
            <WarningBanner>{notice}</WarningBanner>
          </div>
        ) : null}

        {!household ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-sage p-2 text-navy">
                  <Home className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-moss">Step 2</p>
                  <h2 className="mt-1 text-xl font-bold tracking-normal text-ink">Create household</h2>
                  <p className="mt-1 text-sm leading-6 text-ink/60">Start a shared budget space and invite people with a household key.</p>
                </div>
              </div>
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
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-sage p-2 text-navy">
                  <UsersRound className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-moss">Step 2</p>
                  <h2 className="mt-1 text-xl font-bold tracking-normal text-ink">Join household</h2>
                  <p className="mt-1 text-sm leading-6 text-ink/60">Use the household key from another member.</p>
                </div>
              </div>
              <form className="mt-5 space-y-4" onSubmit={handleJoin}>
                <FormField label="Household key">
                  <input
                    className={`${inputClass} uppercase`}
                    value={joinCode}
                    onChange={(event) => setJoinCode(normalizeJoinCode(event.target.value))}
                    placeholder="ABCD1234"
                    autoComplete="off"
                    maxLength={12}
                  />
                </FormField>
                <Button type="submit" variant="secondary" className="w-full" loading={loadingAction === "join"}>
                  Join household
                </Button>
              </form>
            </Card>
          </div>
        ) : showInviteStep ? (
          <Card className="mx-auto max-w-2xl">
            <p className="text-sm font-semibold text-moss">Step 3</p>
            <h2 className="mt-1 text-2xl font-bold tracking-normal text-ink">Invite your partner or household member</h2>
            <p className="mt-2 text-sm leading-6 text-ink/65">
              Share this household key so another member can join and add their own part later.
            </p>
            <div className="mt-5 rounded-2xl border border-sage bg-mist p-5 text-center">
              <p className="text-sm font-medium text-ink/60">Household key</p>
              <p className="mt-2 break-all font-mono text-4xl font-bold tracking-[0.18em] text-ink">{household.join_code}</p>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <Button type="button" variant="secondary" onClick={() => void copyHouseholdKey()}>
                <Copy className="h-4 w-4" aria-hidden="true" />
                Copy household key
              </Button>
              <Button type="button" variant="secondary" onClick={() => void shareHouseholdKey()}>
                <Share2 className="h-4 w-4" aria-hidden="true" />
                Share household key
              </Button>
              <Button type="button" onClick={() => setInviteDismissed(true)}>
                I&apos;ll do this later
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-4">
              <Card>
                <p className="text-sm font-semibold text-moss">Step 4</p>
                <h2 className="mt-1 text-2xl font-bold tracking-normal text-ink">Start your part of the budget</h2>
                <p className="mt-2 text-sm leading-6 text-ink/65">
                  Items added here belong to {userLabel}. Shared household expenses are still attached to the member who added them.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-mist px-3 py-3">
                    <p className="text-xs font-semibold uppercase text-ink/45">Monthly income</p>
                    <p className="mt-1 text-xl font-bold text-ink">{currency(monthlyIncome)}</p>
                  </div>
                  <div className="rounded-xl bg-mist px-3 py-3">
                    <p className="text-xs font-semibold uppercase text-ink/45">Monthly planned</p>
                    <p className="mt-1 text-xl font-bold text-ink">{currency(monthlyPlanned)}</p>
                  </div>
                </div>
              </Card>

              <div className="grid gap-3">
                {ONBOARDING_TEMPLATES.map((template) => {
                  const hasItem = currentUserItems.some((item) => item.budget_kind === template.budgetKind);
                  return (
                    <button
                      key={template.budgetKind}
                      type="button"
                      className={`rounded-2xl border p-4 text-left transition ${
                        activeTemplate.budgetKind === template.budgetKind ? "border-navy bg-white shadow-soft" : "border-white/70 bg-white/75 hover:border-moss"
                      }`}
                      onClick={() => startTemplate(template)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-moss">{template.label}</p>
                          <h3 className="mt-1 font-bold text-ink">{template.title}</h3>
                          <p className="mt-1 text-sm leading-6 text-ink/60">{template.description}</p>
                        </div>
                        {hasItem ? (
                          <span className="rounded-full bg-mint p-1 text-moss">
                            <Check className="h-4 w-4" aria-hidden="true" />
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-xs font-medium text-ink/55">Examples: {template.examples.join(", ")}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <Card>
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-sage p-2 text-navy">
                    <WalletCards className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-moss">{activeTemplate.label}</p>
                    <h2 className="mt-1 text-xl font-bold tracking-normal text-ink">{activeTemplate.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-ink/60">{activeTemplate.description}</p>
                  </div>
                </div>

                <form className="mt-5 space-y-4" onSubmit={handleBudgetItem}>
                  <FormField label="Item name">
                    <input
                      className={inputClass}
                      value={draft.itemName}
                      onChange={(event) => setDraft((current) => ({ ...current, itemName: event.target.value }))}
                      placeholder="Mobile bill"
                    />
                  </FormField>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label="Amount">
                      <input
                        className={inputClass}
                        inputMode="decimal"
                        value={draft.amount}
                        onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))}
                        placeholder="Leave blank if unknown"
                      />
                    </FormField>
                    <FormField label="Frequency">
                      <select
                        className={inputClass}
                        value={draft.frequency}
                        onChange={(event) => setDraft((current) => ({ ...current, frequency: event.target.value as BudgetFrequency }))}
                      >
                        {FREQUENCY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label="Category">
                      <input
                        className={inputClass}
                        list="onboarding-category-options"
                        value={draft.category}
                        onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
                      />
                      <datalist id="onboarding-category-options">
                        {CATEGORY_OPTIONS.map((category) => (
                          <option key={category} value={category} />
                        ))}
                      </datalist>
                    </FormField>
                    <FormField label="Belongs to">
                      <select
                        className={inputClass}
                        value={draft.itemScope}
                        onChange={(event) => {
                          const itemScope = event.target.value as BudgetItemScope;
                          setDraft((current) => ({
                            ...current,
                            itemScope,
                            budgetKind: itemScope === "shared" ? "shared_expense" : current.budgetKind === "shared_expense" ? "regular_expense" : current.budgetKind,
                          }));
                        }}
                      >
                        <option value="personal">My part</option>
                        <option value="shared">Shared household</option>
                      </select>
                    </FormField>
                  </div>

                  <FormField label="Notes">
                    <textarea
                      className={`${inputClass} min-h-20 resize-none`}
                      value={draft.notes}
                      onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                      placeholder="Optional"
                    />
                  </FormField>

                  {draft.amount.trim() ? (
                    <p className="rounded-xl bg-mist px-3 py-2 text-sm text-ink/65">
                      Monthly equivalent:{" "}
                      <span className="font-bold text-ink">
                        {currency(
                          monthlyAmountForBudgetItem({
                            amount: Number(draft.amount),
                            frequency: draft.frequency,
                            quantity: 1,
                            needs_amount: false,
                          }) ?? 0,
                        )}
                      </span>
                    </p>
                  ) : (
                    <p className="rounded-xl bg-mist px-3 py-2 text-sm text-ink/65">Blank amounts stay visible and can be completed later.</p>
                  )}

                  <Button type="submit" className="w-full" loading={loadingAction === "save"}>
                    Add to my budget
                  </Button>
                </form>
              </Card>

              {currentUserItems.length ? (
                <Card>
                  <p className="text-sm font-semibold text-moss">Step 5</p>
                  <h2 className="mt-1 text-xl font-bold tracking-normal text-ink">Do you want to add anything else?</h2>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <Button type="button" variant="secondary" onClick={() => startTemplate(ONBOARDING_TEMPLATES[0])}>
                      Add more income
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => startTemplate(ONBOARDING_TEMPLATES[2])}>
                      Add another bill
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => startTemplate(SHARED_EXPENSE_TEMPLATE)}>
                      Add shared household expense
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => startTemplate(ONBOARDING_TEMPLATES[4])}>
                      Add savings goal
                    </Button>
                    <Button type="button" variant="secondary" loading={loadingAction === "ai"} onClick={() => void handleAskAi()}>
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                      Ask AI what I might be missing
                    </Button>
                    <Button type="button" loading={loadingAction === "complete"} onClick={() => void continueToDashboard()}>
                      Continue to dashboard
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>

                  <p className="mt-4 rounded-xl bg-mist px-3 py-2 text-xs leading-5 text-ink/60">
                    AI suggestions are only budgeting prompts. They do not provide tax, legal, loan, investment, insurance-policy, or product advice.
                  </p>

                  {suggestions.length ? (
                    <div className="mt-4 grid gap-2">
                      {suggestions.map((suggestion) => (
                        <button
                          key={`${suggestion.itemName}-${suggestion.category}`}
                          type="button"
                          className="rounded-xl border border-sage bg-white px-3 py-3 text-left hover:border-moss"
                          onClick={() => startSuggestion(suggestion)}
                        >
                          <p className="font-semibold text-ink">{suggestion.itemName}</p>
                          <p className="mt-1 text-sm leading-6 text-ink/60">{suggestion.reason}</p>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </Card>
              ) : null}

              <Card>
                <h2 className="text-xl font-bold tracking-normal text-ink">Added by you</h2>
                <div className="mt-3 space-y-2">
                  {currentUserItems.length ? (
                    currentUserItems.slice(0, 8).map((item) => (
                      <div key={item.id} className="rounded-xl border border-sage bg-mist px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-ink">{item.item_name}</p>
                            <p className="mt-1 text-xs text-ink/60">
                              {item.category} - {item.item_scope === "shared" ? "Shared household" : "My part"}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-bold text-ink">
                            {monthlyAmountForBudgetItem(item) === null ? "Later" : currency(monthlyAmountForBudgetItem(item) ?? 0)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl border border-dashed border-sage bg-mist px-3 py-4 text-sm text-ink/60">
                      Add income, a bill, a repayment, a goal, or regular spending to start your part.
                    </p>
                  )}
                </div>
              </Card>

              {otherMembers.length ? (
                <Card>
                  <h2 className="text-xl font-bold tracking-normal text-ink">Household members</h2>
                  <p className="mt-2 text-sm leading-6 text-ink/65">
                    {otherMembersWithData.length
                      ? "Another member has started adding their part, so the dashboard can show a combined household picture."
                      : "Other members can add their part later from their own account."}
                  </p>
                </Card>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
