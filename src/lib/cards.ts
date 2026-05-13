export type PaymentCard = {
  id: string;
  name: string;
  shortName: string;
  brand: "bank" | "wallet" | "cash";
  bg: string;
  fg: string;
  accent: string;
};

export const PAYMENT_CARDS: PaymentCard[] = [
  { id: "commbank",   name: "Commonwealth Bank", shortName: "CommBank", brand: "bank",   bg: "#FFD400", fg: "#000000", accent: "#000000" },
  { id: "nab",        name: "NAB",               shortName: "NAB",      brand: "bank",   bg: "#E40C2B", fg: "#FFFFFF", accent: "#FFFFFF" },
  { id: "anz",        name: "ANZ",               shortName: "ANZ",      brand: "bank",   bg: "#004B85", fg: "#FFFFFF", accent: "#FFFFFF" },
  { id: "westpac",    name: "Westpac",           shortName: "Westpac",  brand: "bank",   bg: "#D5002F", fg: "#FFFFFF", accent: "#FFFFFF" },
  { id: "ing",        name: "ING",               shortName: "ING",      brand: "bank",   bg: "#FF6200", fg: "#FFFFFF", accent: "#FFFFFF" },
  { id: "macquarie",  name: "Macquarie",         shortName: "Macquarie",brand: "bank",   bg: "#1F1F1F", fg: "#FFFFFF", accent: "#D5A021" },
  { id: "bankwest",   name: "Bankwest",          shortName: "Bankwest", brand: "bank",   bg: "#0072CE", fg: "#FFFFFF", accent: "#FFFFFF" },
  { id: "stgeorge",   name: "St.George",         shortName: "St.George",brand: "bank",   bg: "#00A551", fg: "#FFFFFF", accent: "#FFFFFF" },
  { id: "ubank",      name: "UBank",             shortName: "UBank",    brand: "bank",   bg: "#000000", fg: "#FFFFFF", accent: "#FFFFFF" },
  { id: "amex",       name: "American Express",  shortName: "Amex",     brand: "wallet", bg: "#2E77BB", fg: "#FFFFFF", accent: "#FFFFFF" },
  { id: "paypal",     name: "PayPal",            shortName: "PayPal",   brand: "wallet", bg: "#003087", fg: "#FFFFFF", accent: "#FFC439" },
  { id: "applepay",   name: "Apple Pay",         shortName: "Apple Pay",brand: "wallet", bg: "#111111", fg: "#FFFFFF", accent: "#FFFFFF" },
  { id: "googlepay",  name: "Google Pay",        shortName: "Google Pay",brand:"wallet", bg: "#FFFFFF", fg: "#1A73E8", accent: "#5F6368" },
  { id: "cash",       name: "Cash",              shortName: "Cash",     brand: "cash",   bg: "#2f6b57", fg: "#FFFFFF", accent: "#FFFFFF" },
  { id: "other",      name: "Other card",        shortName: "Other",    brand: "wallet", bg: "#6b7280", fg: "#FFFFFF", accent: "#FFFFFF" },
];

export function getCard(id?: string | null): PaymentCard | null {
  if (!id) return null;
  return PAYMENT_CARDS.find((card) => card.id === id) ?? null;
}
