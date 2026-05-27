# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start Vite dev server
npm run build     # tsc -b && vite build (used for production / type-checking)
```

There is no test suite and no lint script. Use `npm run build` to catch TypeScript errors across the whole project. Note: the build also type-checks `netlify/functions/` and `vite.config.ts`, which require missing optional dev packages — errors in those files are pre-existing and unrelated to src changes.

## Architecture

### Stack

React 19 + Vite + TypeScript SPA, deployed to Netlify. Backend is entirely Supabase (Auth, Postgres, Row Level Security). Styling is Tailwind CSS with a custom palette defined in `tailwind.config.js` (`ink`, `mist`, `mint`, `sage`, `moss`, `navy`, `coral`, `gold`). Charts use Recharts. AI coaching is a Netlify Function calling OpenAI.

### Data layer: `HouseholdContext`

`src/contexts/HouseholdContext.tsx` is the central data layer for the entire app. It owns all Supabase reads and writes and exposes them via the `useHousehold()` hook. Every page reads from it — there is no other data-fetching layer.

- On mount it loads all household data (categories, expenses, budget items, recurring payments, notifications, etc.) and exposes them as flat arrays.
- All Supabase rows pass through normalizer functions (`normalizeExpense`, `normalizeBudgetItem`, etc.) before entering state, to handle optional columns and joined relation aliases (`row.categories` vs `row.category`).
- Error classification (`classifyLoadIssue`) maps Supabase/PostgREST error codes to typed `DataLoadIssue` values shown to the user in `App.tsx`.
- Optional tables (`planned_budget_items`, `notifications`, `push_subscriptions`) are loaded with graceful fallback — their absence sets `dataWarnings` instead of crashing.
- `createCategory(name)` returns the newly created category's `id` (string) so callers can immediately use it without waiting for a re-render.

### Auth layer: `AuthContext`

`src/contexts/AuthContext.tsx` wraps Supabase Auth and exposes `user` and `loading`. It is separate from `HouseholdContext` so that `App.tsx` can gate on auth before attempting household loads.

### Route guards in `App.tsx`

`AuthRequired` → `HouseholdRequired` → `AppLayout` (renders `<Outlet>`). Pages only render when both a user session and a linked household exist. Onboarding (`/onboarding`) is behind `AuthRequired` but not `HouseholdRequired`.

### Pages

| Route | File |
|---|---|
| `/` | `DashboardPage` |
| `/add` | `AddExpensePage` |
| `/transactions` | `TransactionsPage` |
| `/budget` | `BudgetPage` |
| `/insights` | `InsightsPage` |
| `/reports` | `ReportsPage` |
| `/settings` | `SettingsPage` |

### Categories

Categories live in the Supabase `categories` table, seeded from `src/lib/constants.ts` `DEFAULT_CATEGORIES` on household creation. The "Other" default category (`name === "Other"`) is a catch-all; when a user selects it in `AddExpensePage`, a text input prompts for a specific name. On submit, the code checks `categories` for an existing match (case-insensitive) and reuses it, or calls `createCategory()` to create a new one and gets back its id, then saves the expense under that specific category id. This avoids stacking multiple expenses under a generic "Other".

### Netlify Function

`netlify/functions/budget-coach.ts` receives summarised budget data from `src/lib/coach.ts` and calls the OpenAI Responses API. The OpenAI key is server-side only. The function returns a structured `CoachResponse` JSON object (see README for shape).

### Key `src/lib/` utilities

- `constants.ts` — `DEFAULT_CATEGORIES`, `APP_NAME`, `BUDGET_START_MONTH`
- `budget.ts` — pure functions: `spendingByCategory`, budget calculations
- `format.ts` — `currency()` and other display formatters
- `date.ts` — `toISODate`, month boundary helpers
- `export.ts` — CSV / Excel / PDF export logic
- `supabase.ts` — single Supabase client; exports `hasSupabaseEnv` for guarding offline/missing-config states

### Supabase schema notes

- `expenses` has `category_id` FK to `categories`. Joined rows arrive as `row.categories` (Supabase alias); normalizers map this to `expense.category`.
- Household members join via the `join_household_by_code` RPC (RLS-safe).
- Budget items live in `planned_budget_items`. Several incremental migrations may need to be run in order (see README) when setting up an existing Supabase project.
- Month tracking starts at `2026-05-01` (`BUDGET_START_MONTH`).

### Supabase Data API change (action required before October 30, 2026)

Supabase is changing how the Data API works: from October 30, 2026, any **new** table created in the `public` schema on existing projects will require an explicit `GRANT` before `supabase-js` can access it. Existing tables are unaffected.

Whenever a new migration creates a new table, add this at the end:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.your_new_table TO authenticated;
GRANT SELECT ON public.your_new_table TO anon;
```

Grant `anon` only the minimum it needs (usually just `SELECT`, or nothing at all for user-private tables).
