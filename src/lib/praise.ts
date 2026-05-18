import { currency } from "./format";

const PRAISES = [
  "Good job 👏  {category} — {amount} logged.",
  "Nice tracking 👏  {amount} on {category} added.",
  "Way to stay on top 👏  {category} {amount} captured.",
  "Boom 👏  {category} {amount} logged.",
  "Great work 👏  {amount} added to {category}.",
  "Look at you go 👏  {category} {amount} saved to your records.",
];

const SAVING_PRAISES = [
  "You're investing in future-you 👏 every dollar logged is one in your control.",
  "Tracking is the habit that builds wealth 👏 keep stacking.",
  "Awareness first, freedom next 👏 nice consistency.",
  "Small entries, big picture 👏 you're building the muscle.",
];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function expensePraise(category: string, amount: number) {
  return pick(PRAISES)
    .replace("{category}", category)
    .replace("{amount}", currency(amount));
}

export function savingNudge() {
  return pick(SAVING_PRAISES);
}
