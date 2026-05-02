create table if not exists public.planned_budget_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_user_id uuid references auth.users(id),
  payer_user_id uuid references auth.users(id),
  scope text not null default 'personal',
  item_name text not null,
  category text not null,
  type text not null default 'variable',
  amount numeric(12,2),
  frequency text not null default 'monthly',
  quantity numeric(12,2) not null default 1,
  start_date date,
  notes text,
  needs_amount boolean not null default false,
  is_active boolean not null default true,
  item_scope text not null default 'personal',
  budget_kind text not null default 'regular_expense',
  archived_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.planned_budget_items
  add column if not exists owner_user_id uuid references auth.users(id),
  add column if not exists payer_user_id uuid references auth.users(id),
  add column if not exists scope text not null default 'personal',
  add column if not exists item_scope text not null default 'personal',
  add column if not exists budget_kind text not null default 'regular_expense',
  add column if not exists archived_at timestamptz;

update public.planned_budget_items
set owner_user_id = coalesce(owner_user_id, created_by)
where owner_user_id is null;

update public.planned_budget_items
set scope = coalesce(nullif(scope, ''), item_scope, 'personal'),
    item_scope = coalesce(nullif(item_scope, ''), scope, 'personal')
where scope is null or scope = '' or item_scope is null or item_scope = '';

create index if not exists planned_budget_items_household_scope_active_idx
  on public.planned_budget_items(household_id, scope, is_active, archived_at);

alter table public.planned_budget_items enable row level security;

create or replace function public.save_household_budget_item(
  p_id uuid,
  p_household_id uuid,
  p_owner_user_id uuid,
  p_payer_user_id uuid,
  p_scope text,
  p_item_name text,
  p_category text,
  p_type text,
  p_amount numeric,
  p_frequency text,
  p_quantity numeric,
  p_start_date date,
  p_notes text,
  p_needs_amount boolean,
  p_is_active boolean,
  p_budget_kind text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  saved_id uuid;
  normalized_scope text := case when p_scope = 'shared' then 'shared' else 'personal' end;
  normalized_type text := case
    when p_type in ('income', 'fixed', 'variable', 'debt', 'saving', 'buffer', 'info') then p_type
    else 'variable'
  end;
  normalized_frequency text := case
    when p_frequency in ('weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly', 'one_time', 'unknown') then p_frequency
    else 'monthly'
  end;
begin
  if actor is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_household_member(p_household_id) then
    raise exception 'You are not a member of this household';
  end if;

  if p_owner_user_id is not null and not exists (
    select 1 from public.household_members hm
    where hm.household_id = p_household_id and hm.user_id = p_owner_user_id
  ) then
    raise exception 'Budget item owner must be in this household';
  end if;

  if p_id is null then
    insert into public.planned_budget_items (
      household_id,
      owner_user_id,
      payer_user_id,
      scope,
      item_name,
      category,
      type,
      amount,
      frequency,
      quantity,
      start_date,
      notes,
      needs_amount,
      is_active,
      item_scope,
      budget_kind,
      created_by
    )
    values (
      p_household_id,
      coalesce(p_owner_user_id, actor),
      p_payer_user_id,
      normalized_scope,
      trim(p_item_name),
      trim(p_category),
      normalized_type,
      p_amount,
      normalized_frequency,
      coalesce(p_quantity, 1),
      p_start_date,
      nullif(trim(coalesce(p_notes, '')), ''),
      coalesce(p_needs_amount, p_amount is null),
      coalesce(p_is_active, true),
      normalized_scope,
      coalesce(nullif(p_budget_kind, ''), case when normalized_scope = 'shared' then 'shared_expense' else 'regular_expense' end),
      actor
    )
    returning id into saved_id;
  else
    update public.planned_budget_items
    set owner_user_id = coalesce(p_owner_user_id, owner_user_id, actor),
        payer_user_id = p_payer_user_id,
        scope = normalized_scope,
        item_name = trim(p_item_name),
        category = trim(p_category),
        type = normalized_type,
        amount = p_amount,
        frequency = normalized_frequency,
        quantity = coalesce(p_quantity, 1),
        start_date = p_start_date,
        notes = nullif(trim(coalesce(p_notes, '')), ''),
        needs_amount = coalesce(p_needs_amount, p_amount is null),
        is_active = coalesce(p_is_active, true),
        item_scope = normalized_scope,
        budget_kind = coalesce(nullif(p_budget_kind, ''), budget_kind),
        updated_at = now()
    where id = p_id
      and household_id = p_household_id
      and public.is_household_member(household_id)
    returning id into saved_id;

    if saved_id is null then
      raise exception 'Budget item not found';
    end if;
  end if;

  return saved_id;
end;
$$;

grant execute on function public.save_household_budget_item(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  numeric,
  text,
  numeric,
  date,
  text,
  boolean,
  boolean,
  text
) to authenticated;
