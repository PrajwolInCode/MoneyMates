import type { Handler } from "@netlify/functions";

const systemInstruction =
  "You are a calm household budgeting coach. You help a couple understand their spending without shame. Give practical suggestions based on category spending, fixed payments, and days left in the month. Do not provide tax, investment, legal, loan, or financial product advice. Keep the advice simple, direct, and emotionally supportive.";

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "suggestions", "warning", "todayAction"],
  properties: {
    summary: { type: "string" },
    suggestions: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string" },
    },
    warning: { type: "string" },
    todayAction: { type: "string" },
  },
};

function parseOutputText(payload: any) {
  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }

  const text = payload.output
    ?.flatMap((item: any) => item.content ?? [])
    ?.filter((content: any) => content.type === "output_text")
    ?.map((content: any) => content.text)
    ?.join("");

  return text || "";
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "OPENAI_API_KEY is not configured." }),
    };
  }

  let monthlySummary: unknown;
  try {
    monthlySummary = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body." }) };
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
                text: `Review this household budget summary and return only the requested JSON:\n${JSON.stringify(
                  monthlySummary,
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
            name: "budget_coach_response",
            schema: responseSchema,
            strict: true,
          },
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: "OpenAI request failed.", details: errorBody }),
      };
    }

    const data = await response.json();
    const outputText = parseOutputText(data);
    const parsed = JSON.parse(outputText);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { statusCode: 500, body: JSON.stringify({ error: message }) };
  }
};
