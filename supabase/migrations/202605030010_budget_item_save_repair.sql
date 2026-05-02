create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  type text not null default 'activity',
  title text not null default 'Household activity',
  body text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications
  add column if not exists household_id uuid references public.households(id) on delete cascade,
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists actor_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists type text default 'activity',
  add column if not exists title text default 'Household activity',
  add column if not exists body text default '',
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists read_at timestamptz,
  add column if not exists created_at timestamptz default now();

create index if not exists notifications_user_unread_idx
  on public.notifications(user_id, read_at, created_at desc);

create index if not exists notifications_household_idx
  on public.notifications(household_id, created_at desc);

alter table public.notifications enable row level security;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'Users can view household notifications addressed to them'
  ) then
    alter policy "Users can view household notifications addressed to them"
    on public.notifications
    using (user_id = auth.uid() and public.is_household_member(household_id));
  else
    create policy "Users can view household notifications addressed to them"
    on public.notifications for select
    to authenticated
    using (user_id = auth.uid() and public.is_household_member(household_id));
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'System and members can create household notifications'
  ) then
    alter policy "System and members can create household notifications"
    on public.notifications
    with check (public.is_household_member(household_id));
  else
    create policy "System and members can create household notifications"
    on public.notifications for insert
    to authenticated
    with check (public.is_household_member(household_id));
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'Users can mark their own notifications'
  ) then
    alter policy "Users can mark their own notifications"
    on public.notifications
    using (user_id = auth.uid())
    with check (user_id = auth.uid());
  else
    create policy "Users can mark their own notifications"
    on public.notifications for update
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());
  end if;
end $$;

create table if not exists public.planned_budget_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_user_id uuid references public.profiles(id) on delete set null,
  payer_user_id uuid references public.profiles(id) on delete set null,
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
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.planned_budget_items
  add column if not exists household_id uuid references public.households(id) on delete cascade,
  add column if not exists owner_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists payer_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists scope text not null default 'personal',
  add column if not exists item_name text,
  add column if not exists category text,
  add column if not exists type text default 'variable',
  add column if not exists amount numeric(12,2),
  add column if not exists frequency text default 'monthly',
  add column if not exists quantity numeric(12,2) default 1,
  add column if not exists start_date date,
  add column if not exists notes text,
  add column if not exists needs_amount boolean default false,
  add column if not exists is_active boolean default true,
  add column if not exists item_scope text not null default 'personal',
  add column if not exists budget_kind text not null default 'regular_expense',
  add column if not exists archived_at timestamptz,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.planned_budget_items
set owner_user_id = coalesce(owner_user_id, created_by)
where owner_user_id is null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'planned_budget_items' and column_name = 'name'
  ) then
    update public.planned_budget_items
    set item_name = coalesce(nullif(item_name, ''), nullif(name, ''), 'Budget item')
    where item_name is null or item_name = '';

    update public.planned_budget_items
    set name = coalesce(nullif(name, ''), item_name, 'Budget item')
    where name is null or name = '';

    alter table public.planned_budget_items alter column name drop not null;
    alter table public.planned_budget_items alter column name set default null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'planned_budget_items' and column_name = 'item_type'
  ) then
    update public.planned_budget_items
    set type = coalesce(nullif(type, ''), nullif(item_type, ''), 'variable')
    where type is null or type = '';

    update public.planned_budget_items
    set item_type = coalesce(nullif(item_type, ''), type, 'variable')
    where item_type is null or item_type = '';

    alter table public.planned_budget_items alter column item_type drop not null;
    alter table public.planned_budget_items alter column item_type set default null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'planned_budget_items' and column_name = 'starts_on'
  ) then
    update public.planned_budget_items
    set start_date = coalesce(start_date, starts_on)
    where start_date is null and starts_on is not null;

    alter table public.planned_budget_items alter column starts_on drop not null;
    alter table public.planned_budget_items alter column starts_on set default null;
  end if;
end $$;

update public.planned_budget_items
set scope = coalesce(nullif(scope, ''), item_scope, 'personal'),
    item_scope = coalesce(nullif(item_scope, ''), scope, 'personal')
where scope is null or scope = '' or item_scope is null or item_scope = '';

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

create index if not exists planned_budget_items_household_scope_active_idx
  on public.planned_budget_items(household_id, scope, is_active, archived_at);

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
  normalized_budget_kind text := coalesce(nullif(p_budget_kind, ''), case
    when normalized_type = 'income' then 'income'
    when normalized_type = 'debt' then 'debt_repayment'
    when normalized_type in ('saving', 'buffer') then 'savings_goal'
    when normalized_scope = 'shared' then 'shared_expense'
    when normalized_type = 'fixed' then 'bill'
    else 'regular_expense'
  end);
begin
  if actor is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_household_member(p_household_id) then
    raise exception 'You are not a member of this household';
  end if;

  insert into public.profiles (id, email, display_name)
  select u.id, coalesce(u.email, ''), coalesce(nullif(split_part(coalesce(u.email, ''), '@', 1), ''), 'Housemate')
  from auth.users u
  where u.id in (actor, p_owner_user_id, p_payer_user_id)
  on conflict (id) do nothing;

  if nullif(trim(coalesce(p_item_name, '')), '') is null then
    raise exception 'Budget item name is required';
  end if;

  if nullif(trim(coalesce(p_category, '')), '') is null then
    raise exception 'Budget item category is required';
  end if;

  if p_amount is not null and p_amount < 0 then
    raise exception 'Budget item amount must be zero or greater';
  end if;

  if coalesce(p_quantity, 1) <= 0 then
    raise exception 'Budget item quantity must be greater than zero';
  end if;

  if p_owner_user_id is not null and not exists (
    select 1 from public.household_members hm
    where hm.household_id = p_household_id and hm.user_id = p_owner_user_id
  ) then
    raise exception 'Budget item owner must be in this household';
  end if;

  if p_payer_user_id is not null and not exists (
    select 1 from public.household_members hm
    where hm.household_id = p_household_id and hm.user_id = p_payer_user_id
  ) then
    raise exception 'Budget item payer must be in this household';
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
      normalized_budget_kind,
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
        budget_kind = normalized_budget_kind,
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

create or replace function public.notify_on_budget_item_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
  actor_id uuid := coalesce(new.created_by, auth.uid());
  body_text text;
begin
  if to_regclass('public.notifications') is null then
    return new;
  end if;

  select coalesce(nullif(p.display_name, ''), p.email, 'A household member')
  into actor_name
  from public.profiles p
  where p.id = actor_id;

  body_text := case
    when new.needs_amount or new.amount is null then new.item_name || ' - Needs amount'
    else new.item_name || ' - $' || to_char(new.amount, 'FM999999990.00')
  end;

  insert into public.notifications (household_id, user_id, actor_user_id, type, title, body, metadata)
  select
    new.household_id,
    hm.user_id,
    actor_id,
    'budget_item_added',
    coalesce(actor_name, 'A household member') || ' added a budget item',
    body_text,
    jsonb_build_object('budget_item_id', new.id, 'type', new.type, 'category', new.category)
  from public.household_members hm
  where hm.household_id = new.household_id
    and hm.user_id <> actor_id;

  return new;
exception
  when others then
    return new;
end;
$$;

create or replace function public.notify_on_budget_item_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
  actor_id uuid := auth.uid();
  body_text text;
  notification_type text := 'budget_item_updated';
  title_text text;
begin
  if to_regclass('public.notifications') is null then
    return new;
  end if;

  if old.item_name is not distinct from new.item_name
    and old.category is not distinct from new.category
    and old.type is not distinct from new.type
    and old.amount is not distinct from new.amount
    and old.frequency is not distinct from new.frequency
    and old.quantity is not distinct from new.quantity
    and old.start_date is not distinct from new.start_date
    and old.notes is not distinct from new.notes
    and old.needs_amount is not distinct from new.needs_amount
    and old.is_active is not distinct from new.is_active
    and old.archived_at is not distinct from new.archived_at then
    return new;
  end if;

  select coalesce(nullif(p.display_name, ''), p.email, 'A household member')
  into actor_name
  from public.profiles p
  where p.id = actor_id;

  if new.archived_at is not null and old.archived_at is null then
    notification_type := 'budget_item_deleted';
    title_text := coalesce(actor_name, 'A household member') || ' archived a budget item';
  else
    title_text := coalesce(actor_name, 'A household member') || ' updated a budget item';
  end if;

  body_text := case
    when new.needs_amount or new.amount is null then new.item_name || ' - Needs amount'
    else new.item_name || ' - $' || to_char(new.amount, 'FM999999990.00')
  end;

  insert into public.notifications (household_id, user_id, actor_user_id, type, title, body, metadata)
  select
    new.household_id,
    hm.user_id,
    actor_id,
    notification_type,
    title_text,
    body_text,
    jsonb_build_object('budget_item_id', new.id, 'type', new.type, 'category', new.category)
  from public.household_members hm
  where hm.household_id = new.household_id
    and (actor_id is null or hm.user_id <> actor_id);

  return new;
exception
  when others then
    return new;
end;
$$;

create or replace function public.notify_on_budget_item_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
  actor_id uuid := auth.uid();
  body_text text;
begin
  if to_regclass('public.notifications') is null then
    return old;
  end if;

  select coalesce(nullif(p.display_name, ''), p.email, 'A household member')
  into actor_name
  from public.profiles p
  where p.id = actor_id;

  body_text := case
    when old.needs_amount or old.amount is null then old.item_name || ' - Needs amount'
    else old.item_name || ' - $' || to_char(old.amount, 'FM999999990.00')
  end;

  insert into public.notifications (household_id, user_id, actor_user_id, type, title, body, metadata)
  select
    old.household_id,
    hm.user_id,
    actor_id,
    'budget_item_deleted',
    coalesce(actor_name, 'A household member') || ' deleted a budget item',
    body_text,
    jsonb_build_object('budget_item_id', old.id, 'type', old.type, 'category', old.category)
  from public.household_members hm
  where hm.household_id = old.household_id
    and (actor_id is null or hm.user_id <> actor_id);

  return old;
exception
  when others then
    return old;
end;
$$;

do $$
begin
  drop trigger if exists budget_items_insert_notify_household on public.planned_budget_items;
  drop trigger if exists budget_items_update_notify_household on public.planned_budget_items;
  drop trigger if exists budget_items_delete_notify_household on public.planned_budget_items;
  drop trigger if exists planned_budget_items_insert_notify_household on public.planned_budget_items;
  drop trigger if exists planned_budget_items_update_notify_household on public.planned_budget_items;
  drop trigger if exists planned_budget_items_delete_notify_household on public.planned_budget_items;

  create trigger planned_budget_items_insert_notify_household
  after insert on public.planned_budget_items
  for each row execute function public.notify_on_budget_item_insert();

  create trigger planned_budget_items_update_notify_household
  after update on public.planned_budget_items
  for each row execute function public.notify_on_budget_item_update();

  create trigger planned_budget_items_delete_notify_household
  after delete on public.planned_budget_items
  for each row execute function public.notify_on_budget_item_delete();
end $$;

do $$
begin
  if to_regclass('public.budget_items') is not null then
    alter table public.budget_items
      add column if not exists owner_user_id uuid,
      add column if not exists payer_user_id uuid,
      add column if not exists scope text default 'personal',
      add column if not exists item_scope text default 'personal',
      add column if not exists budget_kind text default 'regular_expense',
      add column if not exists archived_at timestamptz;

    drop trigger if exists budget_items_insert_notify_household on public.budget_items;
    drop trigger if exists budget_items_update_notify_household on public.budget_items;
    drop trigger if exists budget_items_delete_notify_household on public.budget_items;

    create trigger budget_items_insert_notify_household
    after insert on public.budget_items
    for each row execute function public.notify_on_budget_item_insert();

    create trigger budget_items_update_notify_household
    after update on public.budget_items
    for each row execute function public.notify_on_budget_item_update();

    create trigger budget_items_delete_notify_household
    after delete on public.budget_items
    for each row execute function public.notify_on_budget_item_delete();
  end if;
end $$;
