import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, Save } from "lucide-react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { CategoryProgressList } from "../components/CategoryProgressList";
import { FormField } from "../components/FormField";
import { inputClass } from "../components/inputs";
import { PageHeader } from "../components/PageHeader";
import { RecurringList } from "../components/RecurringList";
import { Toast } from "../components/Toast";
import { WarningBanner } from "../components/WarningBanner";
import { useHousehold } from "../contexts/HouseholdContext";
import { totalBudget, totalSpent } from "../lib/budget";
import { formatMonthLabel } from "../lib/date";
import { currency } from "../lib/format";

export function BudgetPage() {
  const {
    categories,
    budgetMonth,
    budgetLimits,
    expenses,
    recurringPayments,
    monthStart,
    isOwner,
    saveBudget,
    createCategory,
    saveRecurringPayment,
    deleteRecurringPayment,
  } = useHousehold();
  const [totalIncome, setTotalIncome] = useState("0");
  const [plannedBudget, setPlannedBudget] = useState("0");
  const [limitValues, setLimitValues] = useState<Record<string, string>>({});
  const [customCategory, setCustomCategory] = useState("");
  const [recurringName, setRecurringName] = useState("");
  const [recurringAmount, setRecurringAmount] = useState("");
  const [recurringDueDay, setRecurringDueDay] = useState("1");
  const [recurringCategoryId, setRecurringCategoryId] = useState("");
  const [saving, setSaving] = useState(false);
  const [categorySaving, setCategorySaving] = useState(false);
  const [recurringSaving, setRecurringSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setTotalIncome(String(Number(budgetMonth?.total_income ?? 0)));
    setPlannedBudget(String(Number(budgetMonth?.planned_budget ?? 0)));
    const next: Record<string, string> = {};
    categories.forEach((category) => {
      const match = budgetLimits.find((limit) => limit.category_id === category.id);
      next[category.id] = String(Number(match?.amount ?? 0));
    });
    setLimitValues(next);
    if (!recurringCategoryId && categories[0]) {
      setRecurringCategoryId(categories[0].id);
    }
  }, [budgetMonth, budgetLimits, categories, recurringCategoryId]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const planned = useMemo(() => totalBudget(budgetMonth, budgetLimits), [budgetMonth, budgetLimits]);
  const spent = useMemo(() => totalSpent(expenses), [expenses]);

  const handleSaveBudget = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const income = Number(totalIncome);
    const plannedTotal = Number(plannedBudget);
    if (income < 0 || plannedTotal < 0) {
      setError("Income and budget amounts cannot be negative.");
      return;
    }

    const limits = categories.map((category) => ({
      category_id: category.id,
      amount: Math.max(0, Number(limitValues[category.id] || 0)),
    }));

    setSaving(true);
    try {
      await saveBudget({ totalIncome: income, plannedBudget: plannedTotal, limits });
      setToast("Budget saved for the month.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save budget.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCategory = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!customCategory.trim()) {
      setError("Enter a category name.");
      return;
    }
    setCategorySaving(true);
    try {
      await createCategory(customCategory.trim());
      setCustomCategory("");
      setToast("Custom category added.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add category.");
    } finally {
      setCategorySaving(false);
    }
  };

  const handleRecurring = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const amount = Number(recurringAmount);
    const dueDay = Number(recurringDueDay);
    if (!recurringName.trim() || amount <= 0 || dueDay < 1 || dueDay > 31 || !recurringCategoryId) {
      setError("Enter a recurring name, amount, due day, and category.");
      return;
    }
    setRecurringSaving(true);
    try {
      await saveRecurringPayment({ name: recurringName.trim(), amount, dueDay, categoryId: recurringCategoryId });
      setRecurringName("");
      setRecurringAmount("");
      setRecurringDueDay("1");
      setToast("Recurring payment added.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add recurring payment.");
    } finally {
      setRecurringSaving(false);
    }
  };

  return (
    <div>
      {toast ? <Toast message={toast} /> : null}
      <PageHeader
        eyebrow={formatMonthLabel(monthStart)}
        title="Budget plan"
        description="Set the monthly income, total plan, category limits, and fixed payments your household wants to respect."
      />

      {!isOwner ? (
        <div className="mb-4">
          <WarningBanner>Only the household owner can change categories, limits, and recurring payments. You can still add expenses.</WarningBanner>
        </div>
      ) : null}

      {error ? (
        <div className="mb-4">
          <WarningBanner tone="strong">{error}</WarningBanner>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <Card>
          <form className="space-y-5" onSubmit={handleSaveBudget}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Total income">
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={totalIncome}
                  disabled={!isOwner}
                  onChange={(event) => setTotalIncome(event.target.value)}
                />
              </FormField>
              <FormField label="Fallback monthly budget">
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={plannedBudget}
                  disabled={!isOwner}
                  onChange={(event) => setPlannedBudget(event.target.value)}
                />
              </FormField>
            </div>

            <div>
              <h2 className="text-xl font-bold tracking-normal text-ink">Category limits</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {categories.map((category) => (
                  <FormField key={category.id} label={category.name}>
                    <input
                      className={inputClass}
                      inputMode="decimal"
                      value={limitValues[category.id] ?? "0"}
                      disabled={!isOwner}
                      onChange={(event) => setLimitValues((current) => ({ ...current, [category.id]: event.target.value }))}
                    />
                  </FormField>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-sage/50 p-4 text-sm text-ink/70">
              Planned: <span className="font-semibold text-ink">{currency(planned)}</span> · Spent:{" "}
              <span className="font-semibold text-ink">{currency(spent)}</span> · Remaining:{" "}
              <span className="font-semibold text-ink">{currency(planned - spent)}</span>
            </div>

            <Button type="submit" loading={saving} disabled={!isOwner}>
              <Save className="h-4 w-4" aria-hidden="true" />
              Save budget
            </Button>
          </form>
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="text-xl font-bold tracking-normal text-ink">Custom categories</h2>
            <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={handleCreateCategory}>
              <input
                className={inputClass}
                value={customCategory}
                disabled={!isOwner}
                onChange={(event) => setCustomCategory(event.target.value)}
                placeholder="Kids activities"
              />
              <Button type="submit" loading={categorySaving} disabled={!isOwner}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add
              </Button>
            </form>
          </Card>

          <Card>
            <h2 className="text-xl font-bold tracking-normal text-ink">Recurring payments</h2>
            <form className="mt-4 space-y-3" onSubmit={handleRecurring}>
              <input
                className={inputClass}
                value={recurringName}
                disabled={!isOwner}
                onChange={(event) => setRecurringName(event.target.value)}
                placeholder="Insurance"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={recurringAmount}
                  disabled={!isOwner}
                  onChange={(event) => setRecurringAmount(event.target.value)}
                  placeholder="120"
                />
                <input
                  className={inputClass}
                  inputMode="numeric"
                  min={1}
                  max={31}
                  value={recurringDueDay}
                  disabled={!isOwner}
                  onChange={(event) => setRecurringDueDay(event.target.value)}
                  placeholder="Due day"
                />
              </div>
              <select className={inputClass} value={recurringCategoryId} disabled={!isOwner} onChange={(event) => setRecurringCategoryId(event.target.value)}>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="secondary" loading={recurringSaving} disabled={!isOwner}>
                Add payment
              </Button>
            </form>
            <div className="mt-4">
              <RecurringList payments={recurringPayments} canManage={isOwner} onDelete={deleteRecurringPayment} />
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <h2 className="text-xl font-bold tracking-normal text-ink">Progress against limits</h2>
        <div className="mt-4">
          <CategoryProgressList expenses={expenses} categories={categories} limits={budgetLimits} />
        </div>
      </Card>
    </div>
  );
}
