import type { Handler } from "@netlify/functions";

const systemInstruction =
  "You are a calm household budgeting setup helper. Suggest only missing budget categories or items based on what the household member has already entered. Do not act as a licensed financial adviser. Do not promise returns. Do not recommend specific financial products. Do not provide tax, legal, loan, insurance-policy, or investment advice. Keep the tone supportive, practical, and habit-building.";

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["suggestions"],
  properties: {
    suggestions: {
      type: "array",
      minItems: 0,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["itemName", "category", "type", "frequency", "budgetKind", "itemScope", "reason"],
        properties: {
          itemName: { type: "string" },
          category: { type: "string" },
          type: { enum: ["income", "fixed", "variable", "debt", "saving", "buffer", "info"] },
          frequency: { enum: ["weekly", "fortnightly", "monthly", "quarterly", "yearly", "one_time", "unknown"] },
          budgetKind: {
            enum: [
              "income",
              "direct_debit",
              "bill",
              "debt_repayment",
              "savings_goal",
              "regular_expense",
              "shared_expense",
              "buffer",
              "info",
            ],
          },
          itemScope: { enum: ["personal", "shared"] },
          reason: { type: "string" },
        },
      },
    },
  },
};

function parseOutputText(payload: any) {
  if (typeof payload.output_text === "string") return payload.output_text;

  return (
    payload.output
      ?.flatMap((item: any) => item.content ?? [])
      ?.filter((content: any) => content.type === "output_text")
      ?.map((content: any) => content.text)
      ?.join("") || ""
  );
}

function joinedText(payload: any) {
  return JSON.stringify(payload ?? {}).toLowerCase();
}

function fallbackSuggestions(payload: any) {
  const text = joinedText(payload);
  const suggestions = [];

  if (!text.includes("income") && !text.includes("salary") && !text.includes("wage")) {
    suggestions.push({
      itemName: "Income",
      category: "Income",
      type: "income",
      frequency: "monthly",
      budgetKind: "income",
      itemScope: "personal",
      reason: "Income lets MoneyMates calculate what is left after bills, spending, and goals.",
    });
  }

  if ((text.includes("car loan") || text.includes("fuel") || text.includes("petrol")) && !text.includes("rego")) {
    suggestions.push({
      itemName: "Rego",
      category: "Transport",
      type: "fixed",
      frequency: "yearly",
      budgetKind: "bill",
      itemScope: "personal",
      reason: "You added a car-related item. Rego is easy to forget because it is not usually monthly.",
    });
  }

  if ((text.includes("car loan") || text.includes("fuel") || text.includes("petrol")) && !text.includes("insurance")) {
    suggestions.push({
      itemName: "Car insurance",
      category: "Insurance",
      type: "fixed",
      frequency: "monthly",
      budgetKind: "bill",
      itemScope: "personal",
      reason: "Car costs often include insurance as well as repayments or fuel.",
    });
  }

  if ((text.includes("rent") || text.includes("mortgage")) && !text.includes("utilities")) {
    suggestions.push({
      itemName: "Utilities",
      category: "Utilities",
      type: "fixed",
      frequency: "monthly",
      budgetKind: "shared_expense",
      itemScope: "shared",
      reason: "Housing costs often sit beside utilities or internet in the household plan.",
    });
  }

  if ((text.includes("salary") || text.includes("income") || text.includes("wage")) && !text.includes("saving")) {
    suggestions.push({
      itemName: "Savings target",
      category: "Savings",
      type: "saving",
      frequency: "monthly",
      budgetKind: "savings_goal",
      itemScope: "personal",
      reason: "Once income is in the plan, a savings target helps turn the plan into a habit.",
    });
  }

  return suggestions.slice(0, 5);
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body." }) };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  if (!apiKey) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suggestions: fallbackSuggestions(payload) }),
    };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions: systemInstruction,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Suggest missing setup items for this household budgeting onboarding. Return only the requested JSON:\n${JSON.stringify(
                  payload,
                  null,
                  2,
                )}`,
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "onboarding_budget_helper_response",
            schema: responseSchema,
            strict: true,
          },
        },
      }),
    });

    if (!response.ok) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestions: fallbackSuggestions(payload) }),
      };
    }

    const data = await response.json();
    const parsed = JSON.parse(parseOutputText(data));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    };
  } catch {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suggestions: fallbackSuggestions(payload) }),
    };
  }
};
