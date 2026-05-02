alter table public.budget_months
  add column if not exists opening_balance numeric(12,2) not null default 0 check (opening_balance >= 0),
  add column if not exists actual_expense numeric(12,2) not null default 0 check (actual_expense >= 0),
  add column if not exists import_mode text not null default 'summary',
  add column if not exists carried_over_amount numeric(12,2) not null default 0 check (carried_over_amount >= 0);

alter table public.budget_months
  drop constraint if exists budget_months_start_date;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.budget_months'::regclass
      and conname = 'budget_months_import_mode_check'
  ) then
    alter table public.budget_months
      add constraint budget_months_import_mode_check
      check (import_mode in ('summary', 'detailed_items'));
  end if;
end $$;
