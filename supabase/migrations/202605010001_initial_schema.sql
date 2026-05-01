create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  join_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint join_code_format check (join_code = upper(join_code) and length(join_code) between 6 and 12)
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  color text not null default '#2f6b57',
  icon text not null default 'wallet',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.budget_months (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  month_start date not null,
  total_income numeric(12,2) not null default 0 check (total_income >= 0),
  planned_budget numeric(12,2) not null default 0 check (planned_budget >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, month_start),
  constraint budget_months_start_date check (month_start >= date '2026-05-01')
);

create table public.budget_limits (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  budget_month_id uuid not null references public.budget_months(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (budget_month_id, category_id)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  spent_on date not null check (spent_on >= date '2026-05-01'),
  merchant text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recurring_payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null,
  amount numeric(12,2) not null check (amount > 0),
  due_day int not null check (due_day between 1 and 31),
  cadence text not null default 'monthly' check (cadence in ('weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly')),
  next_due_on date,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  budget_month_id uuid not null references public.budget_months(id) on delete cascade,
  summary text not null,
  suggestions jsonb not null default '[]'::jsonb,
  warning text not null default '',
  today_action text not null default '',
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index household_members_user_id_idx on public.household_members(user_id);
create index categories_household_id_idx on public.categories(household_id);
create unique index categories_household_lower_name_idx on public.categories(household_id, lower(name));
create index budget_months_household_month_idx on public.budget_months(household_id, month_start);
create index budget_limits_household_id_idx on public.budget_limits(household_id);
create index expenses_household_month_idx on public.expenses(household_id, spent_on);
create index expenses_user_id_idx on public.expenses(user_id);
create index recurring_payments_household_id_idx on public.recurring_payments(household_id);
create index ai_insights_household_id_idx on public.ai_insights(household_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger households_touch_updated_at before update on public.households
for each row execute function public.touch_updated_at();

create trigger budget_months_touch_updated_at before update on public.budget_months
for each row execute function public.touch_updated_at();

create trigger budget_limits_touch_updated_at before update on public.budget_limits
for each row execute function public.touch_updated_at();

create trigger expenses_touch_updated_at before update on public.expenses
for each row execute function public.touch_updated_at();

create trigger recurring_payments_touch_updated_at before update on public.recurring_payments
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), ''),
    coalesce(new.email, '')
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = p_household_id
      and hm.user_id = auth.uid()
  );
$$;

create or replace function public.is_household_owner(p_household_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = p_household_id
      and hm.user_id = auth.uid()
      and hm.role = 'owner'
  );
$$;

create or replace function public.join_household_by_code(p_join_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_household_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select h.id
  into target_household_id
  from public.households h
  where h.join_code = upper(trim(p_join_code));

  if target_household_id is null then
    raise exception 'Invalid join code';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (target_household_id, auth.uid(), 'member')
  on conflict (household_id, user_id) do nothing;

  return target_household_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.categories enable row level security;
alter table public.budget_months enable row level security;
alter table public.budget_limits enable row level security;
alter table public.expenses enable row level security;
alter table public.recurring_payments enable row level security;
alter table public.ai_insights enable row level security;

create policy "Profiles are visible to household mates"
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.household_members mine
    join public.household_members theirs on theirs.household_id = mine.household_id
    where mine.user_id = auth.uid()
      and theirs.user_id = profiles.id
  )
);

create policy "Users update their own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "Users insert their own profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

create policy "Members can view households"
on public.households for select
to authenticated
using (owner_id = auth.uid() or public.is_household_member(id));

create policy "Users can create owned households"
on public.households for insert
to authenticated
with check (owner_id = auth.uid());

create policy "Owners can update households"
on public.households for update
to authenticated
using (public.is_household_owner(id))
with check (public.is_household_owner(id));

create policy "Members can view household members"
on public.household_members for select
to authenticated
using (public.is_household_member(household_id));

create policy "Owners can add themselves as household owner"
on public.household_members for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'owner'
  and exists (
    select 1 from public.households h
    where h.id = household_id
      and h.owner_id = auth.uid()
  )
);

create policy "Owners can manage household members"
on public.household_members for delete
to authenticated
using (public.is_household_owner(household_id));

create policy "Members can view categories"
on public.categories for select
to authenticated
using (public.is_household_member(household_id));

create policy "Owners can insert categories"
on public.categories for insert
to authenticated
with check (public.is_household_owner(household_id));

create policy "Owners can update categories"
on public.categories for update
to authenticated
using (public.is_household_owner(household_id))
with check (public.is_household_owner(household_id));

create policy "Owners can delete categories"
on public.categories for delete
to authenticated
using (public.is_household_owner(household_id));

create policy "Members can view budget months"
on public.budget_months for select
to authenticated
using (public.is_household_member(household_id));

create policy "Owners can insert budget months"
on public.budget_months for insert
to authenticated
with check (public.is_household_owner(household_id));

create policy "Owners can update budget months"
on public.budget_months for update
to authenticated
using (public.is_household_owner(household_id))
with check (public.is_household_owner(household_id));

create policy "Members can view budget limits"
on public.budget_limits for select
to authenticated
using (public.is_household_member(household_id));

create policy "Owners can insert budget limits"
on public.budget_limits for insert
to authenticated
with check (
  public.is_household_owner(household_id)
  and exists (
    select 1 from public.budget_months bm
    where bm.id = budget_month_id
      and bm.household_id = budget_limits.household_id
  )
  and exists (
    select 1 from public.categories c
    where c.id = category_id
      and c.household_id = budget_limits.household_id
  )
);

create policy "Owners can update budget limits"
on public.budget_limits for update
to authenticated
using (public.is_household_owner(household_id))
with check (public.is_household_owner(household_id));

create policy "Owners can delete budget limits"
on public.budget_limits for delete
to authenticated
using (public.is_household_owner(household_id));

create policy "Members can view expenses"
on public.expenses for select
to authenticated
using (public.is_household_member(household_id));

create policy "Members can insert their own expenses"
on public.expenses for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_household_member(household_id)
  and exists (
    select 1 from public.categories c
    where c.id = category_id
      and c.household_id = expenses.household_id
  )
);

create policy "Users can update their own expenses"
on public.expenses for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and public.is_household_member(household_id)
);

create policy "Users can delete their own expenses"
on public.expenses for delete
to authenticated
using (user_id = auth.uid());

create policy "Members can view recurring payments"
on public.recurring_payments for select
to authenticated
using (public.is_household_member(household_id));

create policy "Owners can insert recurring payments"
on public.recurring_payments for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_household_owner(household_id)
);

create policy "Owners can update recurring payments"
on public.recurring_payments for update
to authenticated
using (public.is_household_owner(household_id))
with check (public.is_household_owner(household_id));

create policy "Owners can delete recurring payments"
on public.recurring_payments for delete
to authenticated
using (public.is_household_owner(household_id));

create policy "Members can view AI insights"
on public.ai_insights for select
to authenticated
using (public.is_household_member(household_id));

create policy "Members can create AI insights"
on public.ai_insights for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_household_member(household_id)
);

grant execute on function public.join_household_by_code(text) to authenticated;
