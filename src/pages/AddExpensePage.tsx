import { FormEvent, useEffect, useState } from "react";
import { Info, Save } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "../components/Card";
import { CardPicker } from "../components/CardPicker";
import { FormField } from "../components/FormField";
import { inputClass } from "../components/inputs";
import { PageHeader } from "../components/PageHeader";
import { Toast } from "../components/Toast";
import { WarningBanner } from "../components/WarningBanner";
import { useHousehold } from "../contexts/HouseholdContext";
import { toISODate } from "../lib/date";
import { currency } from "../lib/format";
import { expensePraise } from "../lib/praise";

type FormErrors = {
  amount?: string;
  category?: string;
  date?: string;
};

const QUICK_BUDGET_LINKS = [
  { label: "Add income (salary, payment in)", href: "/budget?add=income", tone: "income" },
  { label: "Add bill or direct debit", href: "/budget?add=bill" },
  { label: "Add shared household expense", href: "/budget?add=shared_expense" },
  { label: "Add personal expense", href: "/budget?add=personal_expense" },
  { label: "Add debt repayment", href: "/budget?add=debt" },
  { label: "Add savings goal", href: "/budget?add=saving" },
];

export function AddExpensePage() {
  const { categories, addExpense, createCategory } = useHousehold();
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [otherLabel, setOtherLabel] = useState("");
  const [spentOn, setSpentOn] = useState(toISODate(new Date()));
  const [merchant, setMerchant] = useState("");
  const [note, setNote] = useState("");
  const [cardId, setCardId] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const isOther = selectedCategory?.name === "Other";

  useEffect(() => {
    if (!categoryId && categories[0]) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const validate = () => {
    const nextErrors: FormErrors = {};
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      nextErrors.amount = "Enter an amount greater than zero.";
    }
    if (!categoryId) {
      nextErrors.category = "Choose a category.";
    } else if (isOther && !otherLabel.trim()) {
      nextErrors.category = "Please describe what this expense is for.";
    }
    if (!spentOn) {
      nextErrors.date = "Choose a date.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaveError(null);
    if (!validate()) return;

    setSaving(true);
    try {
      const savedAmount = Number(amount);
      let resolvedCategoryId = categoryId;
      let resolvedCategoryName = selectedCategory?.name ?? "Expense";

      if (isOther && otherLabel.trim()) {
        const label = otherLabel.trim();
        const existing = categories.find((c) => c.name.toLowerCase() === label.toLowerCase());
        if (existing) {
          resolvedCategoryId = existing.id;
          resolvedCategoryName = existing.name;
        } else {
          resolvedCategoryId = await createCategory(label);
          resolvedCategoryName = label;
        }
      }

      await addExpense({
        amount: savedAmount,
        category_id: resolvedCategoryId,
        spent_on: spentOn,
        merchant: merchant.trim(),
        note: note.trim(),
        card_id: cardId,
      });
      setAmount("");
      setMerchant("");
      setNote("");
      setOtherLabel("");
      setCardId(null);
      setToast(expensePraise(resolvedCategoryName, savedAmount));
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "Could not save expense.");
    } finally {
      setSaving(false);
    }
  };

  const parsedAmount = Number(amount);
  const previewReady = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const previewLabel = isOther && otherLabel.trim() ? otherLabel.trim() : selectedCategory?.name ?? "";

  return (
    <div className="pb-36 md:pb-0">
      {toast ? <Toast message={toast} tone="praise" /> : null}
      <PageHeader
        eyebrow="Quick log"
        title="Add an expense"
        description="Record money you spent today. Fill the form and tap Save expense — the green button at the bottom."
      />

      <Card className="mx-auto max-w-2xl">
        <form id="add-expense-form" className="space-y-4" onSubmit={handleSubmit}>
          <FormField label="How much was it?" error={errors.amount} hint="Use dollars and cents, for example 42.50">
            <input
              className={inputClass}
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="42.50"
            />
          </FormField>

          <FormField label="What was it for?" error={errors.category} hint="Pick the closest match. Choose Other to type a new label.">
            <select className={inputClass} value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setOtherLabel(""); }}>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {isOther && (
              <input
                className={`${inputClass} mt-2`}
                value={otherLabel}
                onChange={(event) => setOtherLabel(event.target.value)}
                placeholder="What is this expense for?"
                autoFocus
              />
            )}
          </FormField>

          {previewReady && previewLabel ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-moss/20 bg-mint px-4 py-3 text-sm">
              <span className="font-semibold text-moss">Ready to save</span>
              <span className="truncate font-bold text-ink">
                {previewLabel} · {currency(parsedAmount)}
              </span>
            </div>
          ) : null}

          <FormField label="When did it happen?" error={errors.date}>
            <input className={inputClass} type="date" value={spentOn} onChange={(event) => setSpentOn(event.target.value)} />
          </FormField>

          <FormField label="Where did you buy it?" hint="Shop, app, or place name. Helps you spot repeat spending later.">
            <input className={inputClass} value={merchant} onChange={(event) => setMerchant(event.target.value)} placeholder="Woolworths" />
          </FormField>

          <CardPicker
            value={cardId}
            onChange={setCardId}
            helperText="Tap the card you paid with so we can show totals per card."
          />

          <FormField label="Note (optional)" hint="Anything you want to remember about this expense.">
            <textarea
              className={`${inputClass} min-h-28 resize-none`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional detail"
            />
          </FormField>

          {saveError ? <WarningBanner tone="strong">{saveError}</WarningBanner> : null}

          <div className="hidden sm:block">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-moss px-4 py-3 text-base font-bold text-white shadow-elevated transition hover:bg-navy disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-5 w-5" aria-hidden="true" />
              {saving ? "Saving expense..." : "Save expense"}
            </button>
          </div>
        </form>

        <div className="mt-6 border-t border-sage/60 pt-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink/45">
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            Not a one-off expense? Set up recurring items here:
          </div>
          <p className="mb-3 text-xs text-ink/55">
            Money in (salary), bills, and savings goals live in Budget so they keep updating each month automatically.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK_BUDGET_LINKS.map((item) => (
              <Link
                key={item.href}
                className={`rounded-xl border border-sage/50 px-3 py-2 text-xs font-medium hover:bg-sage/30 ${
                  item.tone === "income" ? "bg-mint/40 text-moss" : "bg-white text-ink/70"
                }`}
                to={item.href}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </Card>

      <div className="safe-bottom fixed inset-x-0 bottom-16 z-30 border-t border-sage/60 bg-white/95 px-4 py-3 backdrop-blur-md shadow-soft sm:hidden">
        <button
          type="submit"
          form="add-expense-form"
          disabled={saving}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-moss px-4 py-3 text-base font-bold text-white shadow-elevated transition active:scale-[0.98] disabled:opacity-60"
        >
          <Save className="h-5 w-5" aria-hidden="true" />
          {saving ? "Saving expense..." : previewReady && previewLabel ? `Save ${currency(parsedAmount)}` : "Save expense"}
        </button>
      </div>
    </div>
  );
}
