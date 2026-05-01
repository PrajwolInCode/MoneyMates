import type { CoachResponse, MonthlyCoachPayload } from "../types";

export async function requestBudgetCoach(payload: MonthlyCoachPayload): Promise<CoachResponse> {
  const response = await fetch("/.netlify/functions/budget-coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || "The budget coach could not respond right now.");
  }

  return data as CoachResponse;
}
