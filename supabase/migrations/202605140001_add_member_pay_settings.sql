-- Adds per-member pay frequency settings so MoneyMates can remind a member
-- to add income on their pay cycle, and tracks the last income confirmation.
alter table public.household_members
  add column if not exists pay_frequency text,
  add column if not exists pay_anchor_date date,
  add column if not exists last_income_checkin_at timestamptz;

do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_schema = 'public'
      and table_name = 'household_members'
      and constraint_name = 'household_members_pay_frequency_check'
  ) then
    alter table public.household_members
      add constraint household_members_pay_frequency_check
      check (pay_frequency is null or pay_frequency in ('weekly', 'fortnightly', 'monthly'));
  end if;
end$$;

-- Refresh PostgREST schema cache so new columns appear immediately.
notify pgrst, 'reload schema';
