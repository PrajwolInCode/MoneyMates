import type { CategorySeed } from "../types";

export const BUDGET_START_MONTH = "2026-05-01";
export const APP_NAME = "MoneyMates";

export const DEFAULT_CATEGORIES: CategorySeed[] = [
  { name: "Groceries", color: "#2f6b57", icon: "shopping-basket" },
  { name: "Petrol", color: "#246a73", icon: "fuel" },
  { name: "Car loan", color: "#6b5b95", icon: "car" },
  { name: "Mortgage/house loan", color: "#0f3d3e", icon: "home" },
  { name: "Insurance", color: "#577590", icon: "shield" },
  { name: "Outings", color: "#de6b5f", icon: "sparkles" },
  { name: "Gifts", color: "#c58b2c", icon: "gift" },
  { name: "Clothes", color: "#9c6ade", icon: "shirt" },
  { name: "Eating out", color: "#e07a5f", icon: "utensils" },
  { name: "Pets", color: "#5a7d7c", icon: "paw-print" },
  { name: "Subscriptions", color: "#4d908e", icon: "repeat" },
  { name: "Family help", color: "#b56576", icon: "heart-handshake" },
  { name: "Medical", color: "#d1495b", icon: "heart-pulse" },
  { name: "Emergency", color: "#bc4749", icon: "siren" },
  { name: "Other", color: "#6b7280", icon: "wallet" },
];
