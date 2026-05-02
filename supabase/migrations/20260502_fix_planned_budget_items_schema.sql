create extension if not exists pgcrypto;

create table if not exists public.planned_budget_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade,
  item_name text,
  category text,
  type text default 'variable',
  amount numeric(12,2),
  frequency text default 'monthly',
  quantity numeric(12,2) default 1,
  start_date date,
  notes text,
  needs_amount boolean default false,
  is_active boolean default true,
  archived_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.planned_budget_items add column if not exists id uuid default gen_random_uuid();
alter table public.planned_budget_items add column if not exists household_id uuid references public.households(id) on delete cascade;
alter table public.planned_budget_items add column if not exists item_name text;
alter table public.planned_budget_items add column if not exists category text;
alter table public.planned_budget_items add column if not exists type text;
alter table public.planned_budget_items add column if not exists amount numeric(12,2);
alter table public.planned_budget_items add column if not exists frequency text;
alter table public.planned_budget_items add column if not exists quantity numeric(12,2);
alter table public.planned_budget_items add column if not exists start_date date;
alter table public.planned_budget_items add column if not exists notes text;
alter table public.planned_budget_items add column if not exists needs_amount boolean;
alter table public.planned_budget_items add column if not exists is_active boolean;
alter table public.planned_budget_items add column if not exists archived_at timestamptz;
alter table public.planned_budget_items add column if not exists created_by uuid references auth.users(id);
alter table public.planned_budget_items add column if not exists created_at timestamptz;
alter table public.planned_budget_items add column if not exists updated_at timestamptz;

update public.planned_budget_items set id = gen_random_uuid() where id is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.planned_budget_items'::regclass
      and contype = 'p'
  ) then
    alter table public.planned_budget_items add constraint planned_budget_items_pkey primary key (id);
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'planned_budget_items' and column_name = 'name'
  ) then
    update public.planned_budget_items
    set item_name = name
    where item_name is null and name is not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'planned_budget_items' and column_name = 'item_type'
  ) then
    update public.planned_budget_items
    set type = item_type
    where type is null and item_type is not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'planned_budget_items' and column_name = 'starts_on'
  ) then
    update public.planned_budget_items
    set start_date = starts_on
    where start_date is null and starts_on is not null;
  end if;
end $$;

alter table public.planned_budget_items alter column id set default gen_random_uuid();
alter table public.planned_budget_items alter column type set default 'variable';
alter table public.planned_budget_items alter column frequency set default 'monthly';
alter table public.planned_budget_items alter column quantity set default 1;
alter table public.planned_budget_items alter column needs_amount set default false;
alter table public.planned_budget_items alter column is_active set default true;
alter table public.planned_budget_items alter column created_at set default now();
alter table public.planned_budget_items alter column updated_at set default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.planned_budget_items'::regclass
      and conname = 'planned_budget_items_amount_nonnegative'
  ) then
    alter table public.planned_budget_items
      add constraint planned_budget_items_amount_nonnegative
      check (amount is null or amount >= 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.planned_budget_items'::regclass
      and conname = 'planned_budget_items_quantity_positive'
  ) then
    alter table public.planned_budget_items
      add constraint planned_budget_items_quantity_positive
      check (quantity > 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.planned_budget_items'::regclass
      and conname = 'planned_budget_items_type_check'
  ) then
    alter table public.planned_budget_items
      add constraint planned_budget_items_type_check
      check (type in ('income', 'fixed', 'variable', 'debt', 'saving', 'buffer', 'info')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.planned_budget_items'::regclass
      and conname = 'planned_budget_items_frequency_check'
  ) then
    alter table public.planned_budget_items
      add constraint planned_budget_items_frequency_check
      check (frequency in ('weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly', 'one_time', 'unknown')) not valid;
  end if;
end $$;

alter table public.planned_budget_items enable row level security;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'planned_budget_items' and policyname = 'Members can view planned budget items'
  ) then
    alter policy "Members can view planned budget items"
    on public.planned_budget_items
    using (public.is_household_member(household_id));
  else
    create policy "Members can view planned budget items"
    on public.planned_budget_items for select
    to authenticated
    using (public.is_household_member(household_id));
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'planned_budget_items' and policyname = 'Members can create planned budget items'
  ) then
    alter policy "Members can create planned budget items"
    on public.planned_budget_items
    with check (public.is_household_member(household_id) and (created_by is null or created_by = auth.uid()));
  else
    create policy "Members can create planned budget items"
    on public.planned_budget_items for insert
    to authenticated
    with check (public.is_household_member(household_id) and (created_by is null or created_by = auth.uid()));
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'planned_budget_items' and policyname = 'Members can update planned budget items'
  ) then
    alter policy "Members can update planned budget items"
    on public.planned_budget_items
    using (public.is_household_member(household_id))
    with check (public.is_household_member(household_id));
  else
    create policy "Members can update planned budget items"
    on public.planned_budget_items for update
    to authenticated
    using (public.is_household_member(household_id))
    with check (public.is_household_member(household_id));
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'planned_budget_items' and policyname = 'Members can delete planned budget items'
  ) then
    alter policy "Members can delete planned budget items"
    on public.planned_budget_items
    using (public.is_household_member(household_id));
  else
    create policy "Members can delete planned budget items"
    on public.planned_budget_items for delete
    to authenticated
    using (public.is_household_member(household_id));
  end if;
end $$;

create index if not exists planned_budget_items_household_id_idx
  on public.planned_budget_items(household_id);

create index if not exists planned_budget_items_household_archived_idx
  on public.planned_budget_items(household_id, archived_at);

create index if not exists planned_budget_items_household_active_idx
  on public.planned_budget_items(household_id, is_active);

do $$
begin
  if to_regclass('public.touch_updated_at') is not null
     and not exists (
       select 1
       from pg_trigger
       where tgname = 'planned_budget_items_touch_updated_at'
         and tgrelid = 'public.planned_budget_items'::regclass
     ) then
    create trigger planned_budget_items_touch_updated_at
    before update on public.planned_budget_items
    for each row execute function public.touch_updated_at();
  end if;
end $$;
