-- Adds an optional card_id column to expenses so members can record which payment
-- card or wallet was used. Stores the card identifier from src/lib/cards.ts.
alter table public.expenses
  add column if not exists card_id text;

create index if not exists expenses_household_card_idx
  on public.expenses(household_id, card_id);

-- Refresh PostgREST schema cache so the new column is visible immediately.
notify pgrst, 'reload schema';
