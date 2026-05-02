import { FormEvent, useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { FormField } from "../components/FormField";
import { inputClass } from "../components/inputs";
import { PageHeader } from "../components/PageHeader";
import { Toast } from "../components/Toast";
import { WarningBanner } from "../components/WarningBanner";
import { useHousehold } from "../contexts/HouseholdContext";
import { toISODate } from "../lib/date";

type FormErrors = {
  amount?: string;
  category?: string;
  date?: string;
};

export function AddExpensePage() {
  const { categories, addExpense } = useHousehold();
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [spentOn, setSpentOn] = useState(toISODate(new Date()));
  const [merchant, setMerchant] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!categoryId && categories[0]) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2600);
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
      await addExpense({
        amount: Number(amount),
        category_id: categoryId,
        spent_on: spentOn,
        merchant: merchant.trim(),
        note: note.trim(),
      });
      setAmount("");
      setMerchant("");
      setNote("");
      setToast("Expense saved. Your household totals are updated.");
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "Could not save expense.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {toast ? <Toast message={toast} /> : null}
      <PageHeader
        eyebrow="Manual input"
        title="Add expense"
        description="Record what was spent, when it happened, and who added it. Small daily accuracy keeps the plan honest."
      />

      <Card className="mx-auto max-w-2xl">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <FormField label="Amount" error={errors.amount}>
            <input
              className={inputClass}
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="42.50"
            />
          </FormField>

          <FormField label="Category" error={errors.category}>
            <select className={inputClass} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Date" error={errors.date}>
            <input className={inputClass} type="date" value={spentOn} onChange={(event) => setSpentOn(event.target.value)} />
          </FormField>

          <FormField label="Merchant or place">
            <input className={inputClass} value={merchant} onChange={(event) => setMerchant(event.target.value)} placeholder="Woolworths" />
          </FormField>

          <FormField label="Note">
            <textarea
              className={`${inputClass} min-h-28 resize-none`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional detail"
            />
          </FormField>

          {saveError ? <WarningBanner tone="strong">{saveError}</WarningBanner> : null}

          <Button type="submit" className="w-full" loading={saving}>
            <Save className="h-4 w-4" aria-hidden="true" />
            Save expense
          </Button>
        </form>
      </Card>
    </div>
  );
}
