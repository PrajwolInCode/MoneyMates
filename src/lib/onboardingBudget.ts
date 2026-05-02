import type { BudgetFrequency, BudgetItem, BudgetItemKind, BudgetItemScope, BudgetItemType } from "../types";

export type BudgetOnboardingTemplate = {
  budgetKind: BudgetItemKind;
  label: string;
  title: string;
  description: string;
  examples: string[];
  itemName: string;
  category: string;
  type: BudgetItemType;
  frequency: BudgetFrequency;
  scope: BudgetItemScope;
};

export type OnboardingSuggestion = {
  itemName: string;
  category: string;
  type: BudgetItemType;
  frequency: BudgetFrequency;
  budgetKind: BudgetItemKind;
  scope: BudgetItemScope;
  reason: string;
};

export type OnboardingHelperPayload = {
  items: Array<{
    itemName: string;
    category: string;
    type: BudgetItemType;
    budgetKind: BudgetItemKind;
    scope: BudgetItemScope;
  }>;
};

export const ONBOARDING_TEMPLATES: BudgetOnboardingTemplate[] = [
  {
    budgetKind: "income",
    label: "Income",
    title: "Add income",
    description: "Salary, wages, benefits, side income, or any regular money coming in.",
    examples: ["Salary", "Wages", "Side income"],
    itemName: "Salary",
    category: "Income",
    type: "income",
    frequency: "monthly",
    scope: "personal",
  },
  {
    budgetKind: "direct_debit",
    label: "Direct debits",
    title: "Add a direct debit",
    description: "Subscriptions and automatic payments that leave your account regularly.",
    examples: ["Gym membership", "Streaming", "Software subscription"],
    itemName: "Gym membership",
    category: "Direct debits",
    type: "fixed",
    frequency: "monthly",
    scope: "personal",
  },
  {
    budgetKind: "bill",
    label: "Bills",
    title: "Add a personal bill",
    description: "Bills that belong to you before the household combines the full picture.",
    examples: ["Mobile bill", "Insurance", "Rego"],
    itemName: "Mobile bill",
    category: "Bills",
    type: "fixed",
    frequency: "monthly",
    scope: "personal",
  },
  {
    budgetKind: "debt_repayment",
    label: "Debt repayments",
    title: "Add a repayment",
    description: "Regular repayments such as loans or credit cards.",
    examples: ["Car loan", "Credit card repayment", "Personal loan"],
    itemName: "Credit card repayment",
    category: "Debt",
    type: "debt",
    frequency: "monthly",
    scope: "personal",
  },
  {
    budgetKind: "savings_goal",
    label: "Savings goal",
    title: "Add a savings goal",
    description: "A regular amount you want to set aside.",
    examples: ["Savings target", "Emergency fund", "Holiday fund"],
    itemName: "Savings target",
    category: "Savings",
    type: "saving",
    frequency: "monthly",
    scope: "personal",
  },
  {
    budgetKind: "regular_expense",
    label: "Regular expenses",
    title: "Add regular spending",
    description: "Everyday spending that changes but still needs a plan.",
    examples: ["Fuel", "Personal spending", "Lunches"],
    itemName: "Personal spending",
    category: "Personal spending",
    type: "variable",
    frequency: "monthly",
    scope: "personal",
  },
];

export const SHARED_EXPENSE_TEMPLATE: BudgetOnboardingTemplate = {
  budgetKind: "shared_expense",
  label: "Shared expense",
  title: "Add a shared household expense",
  description: "A household cost everyone should see in the combined plan.",
  examples: ["Rent", "Groceries", "Utilities"],
  itemName: "Shared household expense",
  category: "Shared household",
  type: "fixed",
  frequency: "monthly",
  scope: "shared",
};

const SUGGESTION_RULES: Array<{
  when: RegExp[];
  missing: RegExp;
  suggestion: OnboardingSuggestion;
}> = [
  {
    when: [/car loan|fuel|petrol|vehicle|car/i],
    missing: /rego|registration/i,
    suggestion: {
      itemName: "Rego",
      category: "Transport",
      type: "fixed",
      frequency: "yearly",
      budgetKind: "bill",
      scope: "personal",
      reason: "You added a car-related item. Rego is easy to forget because it is not usually monthly.",
    },
  },
  {
    when: [/car loan|fuel|petrol|vehicle|car/i],
    missing: /insurance/i,
    suggestion: {
      itemName: "Car insurance",
      category: "Insurance",
      type: "fixed",
      frequency: "monthly",
      budgetKind: "bill",
      scope: "personal",
      reason: "Car costs often include insurance as well as repayments or fuel.",
    },
  },
  {
    when: [/car loan|fuel|petrol|vehicle|car/i],
    missing: /servic|maintenance/i,
    suggestion: {
      itemName: "Car servicing",
      category: "Transport",
      type: "variable",
      frequency: "monthly",
      budgetKind: "regular_expense",
      scope: "personal",
      reason: "A small monthly allowance can make servicing feel less sudden.",
    },
  },
  {
    when: [/salary|wage|income|pay/i],
    missing: /saving|emergency|buffer/i,
    suggestion: {
      itemName: "Savings target",
      category: "Savings",
      type: "saving",
      frequency: "monthly",
      budgetKind: "savings_goal",
      scope: "personal",
      reason: "Once income is in the plan, a savings target helps turn the plan into a habit.",
    },
  },
  {
    when: [/rent|mortgage|home|house/i],
    missing: /utilities|electric|gas|water|internet/i,
    suggestion: {
      itemName: "Utilities",
      category: "Utilities",
      type: "fixed",
      frequency: "monthly",
      budgetKind: "shared_expense",
      scope: "shared",
      reason: "Housing costs often sit beside utilities or internet in the household plan.",
    },
  },
  {
    when: [/mobile|phone|internet|subscription|gym|streaming/i],
    missing: /direct debit|subscription|membership/i,
    suggestion: {
      itemName: "Other direct debits",
      category: "Direct debits",
      type: "fixed",
      frequency: "monthly",
      budgetKind: "direct_debit",
      scope: "personal",
      reason: "A quick direct debit check can catch small payments that quietly add up.",
    },
  },
  {
    when: [/grocer|food|dining|fuel|petrol|personal spending/i],
    missing: /personal spending|cash|flexible/i,
    suggestion: {
      itemName: "Personal spending",
      category: "Personal spending",
      type: "variable",
      frequency: "weekly",
      budgetKind: "regular_expense",
      scope: "personal",
      reason: "Flexible spending is easier to adjust when it has a simple allowance.",
    },
  },
];

function normalizeText(items: OnboardingHelperPayload["items"]) {
  return items.map((item) => `${item.itemName} ${item.category} ${item.budgetKind}`).join(" ");
}

function hasAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function uniqueSuggestions(suggestions: OnboardingSuggestion[]) {
  const seen = new Set<string>();
  return suggestions.filter((suggestion) => {
    const key = `${suggestion.itemName.toLowerCase()}-${suggestion.category.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildOnboardingHelperPayload(items: BudgetItem[]): OnboardingHelperPayload {
  return {
    items: items.map((item) => ({
      itemName: item.item_name,
      category: item.category,
      type: item.type,
      budgetKind: item.budget_kind,
      scope: item.scope,
    })),
  };
}

export function suggestMissingBudgetItems(payload: OnboardingHelperPayload): OnboardingSuggestion[] {
  const text = normalizeText(payload.items);
  const suggestions = SUGGESTION_RULES.filter((rule) => hasAny(text, rule.when) && !rule.missing.test(text)).map((rule) => rule.suggestion);

  if (!payload.items.some((item) => item.type === "income")) {
    suggestions.unshift({
      itemName: "Income",
      category: "Income",
      type: "income",
      frequency: "monthly",
      budgetKind: "income",
      scope: "personal",
      reason: "Income lets MoneyMates calculate what is left after bills, spending, and goals.",
    });
  }

  return uniqueSuggestions(suggestions).slice(0, 5);
}

export async function requestOnboardingBudgetHelper(payload: OnboardingHelperPayload): Promise<OnboardingSuggestion[]> {
  const response = await fetch("/.netlify/functions/onboarding-budget-helper", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || "The budget helper could not respond right now.");
  }

  return Array.isArray(data?.suggestions) ? (data.suggestions as OnboardingSuggestion[]) : [];
}
