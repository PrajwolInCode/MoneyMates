alter table public.household_members
  add column if not exists budget_setup_completed_at timestamptz;

create index if not exists household_members_budget_setup_idx
  on public.household_members(household_id, budget_setup_completed_at);

drop policy if exists "Members can update their own setup state"
on public.household_members;

create or replace function public.complete_household_budget_setup(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  completing_user_id uuid := auth.uid();
begin
  if completing_user_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.household_members
  set budget_setup_completed_at = now()
  where household_id = p_household_id
    and user_id = completing_user_id;

  if not found then
    raise exception 'Household membership not found';
  end if;
end;
$$;

grant execute on function public.complete_household_budget_setup(uuid) to authenticated;

do $$
begin
  if to_regclass('public.planned_budget_items') is not null then
    alter table public.planned_budget_items
      add column if not exists item_scope text;

    update public.planned_budget_items
    set item_scope = 'personal'
    where item_scope is null;

    alter table public.planned_budget_items
      alter column item_scope set default 'personal';

    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.planned_budget_items'::regclass
        and conname = 'planned_budget_items_item_scope_check'
    ) then
      alter table public.planned_budget_items
        add constraint planned_budget_items_item_scope_check
        check (item_scope in ('personal', 'shared')) not valid;
    end if;

    alter table public.planned_budget_items
      add column if not exists budget_kind text;

    update public.planned_budget_items
    set budget_kind = case
      when type = 'income' then 'income'
      when type = 'debt' then 'debt_repayment'
      when type = 'saving' then 'savings_goal'
      when type = 'buffer' then 'buffer'
      when type = 'info' then 'info'
      when type = 'fixed' then 'bill'
      else 'regular_expense'
    end
    where budget_kind is null;

    alter table public.planned_budget_items
      alter column budget_kind set default 'regular_expense';

    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.planned_budget_items'::regclass
        and conname = 'planned_budget_items_budget_kind_check'
    ) then
      alter table public.planned_budget_items
        add constraint planned_budget_items_budget_kind_check
        check (budget_kind in ('income', 'direct_debit', 'bill', 'debt_repayment', 'savings_goal', 'regular_expense', 'shared_expense', 'buffer', 'info')) not valid;
    end if;

    create index if not exists planned_budget_items_household_scope_idx
      on public.planned_budget_items(household_id, item_scope);

    create index if not exists planned_budget_items_created_by_kind_idx
      on public.planned_budget_items(created_by, budget_kind);
  end if;
end $$;

do $$
begin
  if to_regclass('public.budget_items') is not null then
    alter table public.budget_items
      add column if not exists item_scope text;

    update public.budget_items
    set item_scope = 'personal'
    where item_scope is null;

    alter table public.budget_items
      alter column item_scope set default 'personal';

    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.budget_items'::regclass
        and conname = 'budget_items_item_scope_check'
    ) then
      alter table public.budget_items
        add constraint budget_items_item_scope_check
        check (item_scope in ('personal', 'shared')) not valid;
    end if;

    alter table public.budget_items
      add column if not exists budget_kind text;

    update public.budget_items
    set budget_kind = case
      when type = 'income' then 'income'
      when type = 'debt' then 'debt_repayment'
      when type = 'saving' then 'savings_goal'
      when type = 'buffer' then 'buffer'
      when type = 'info' then 'info'
      when type = 'fixed' then 'bill'
      else 'regular_expense'
    end
    where budget_kind is null;

    alter table public.budget_items
      alter column budget_kind set default 'regular_expense';

    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.budget_items'::regclass
        and conname = 'budget_items_budget_kind_check'
    ) then
      alter table public.budget_items
        add constraint budget_items_budget_kind_check
        check (budget_kind in ('income', 'direct_debit', 'bill', 'debt_repayment', 'savings_goal', 'regular_expense', 'shared_expense', 'buffer', 'info')) not valid;
    end if;

    create index if not exists budget_items_household_scope_idx
      on public.budget_items(household_id, item_scope);

    create index if not exists budget_items_created_by_kind_idx
      on public.budget_items(created_by, budget_kind);
  end if;
end $$;
