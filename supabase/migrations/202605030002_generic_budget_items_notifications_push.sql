create table public.budget_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  item_name text not null,
  category text not null,
  type text not null check (type in ('income', 'fixed', 'variable', 'debt', 'saving', 'buffer', 'info')),
  amount numeric(12,2) check (amount is null or amount >= 0),
  frequency text not null default 'monthly' check (frequency in ('weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly', 'one_time', 'unknown')),
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  start_date date,
  notes text,
  needs_amount boolean not null default false,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  monthly_amount numeric(12,2) generated always as (
    case
      when needs_amount or amount is null or frequency = 'unknown' then null
      when frequency = 'weekly' then amount * quantity * 52 / 12
      when frequency = 'fortnightly' then amount * quantity * 26 / 12
      when frequency = 'monthly' then amount * quantity
      when frequency = 'quarterly' then amount * quantity / 3
      when frequency = 'yearly' then amount * quantity / 12
      when frequency = 'one_time' then amount * quantity
      else null
    end
  ) stored,
  constraint budget_items_name_length check (char_length(trim(item_name)) between 1 and 120),
  constraint budget_items_category_length check (char_length(trim(category)) between 1 and 80)
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index budget_items_household_active_idx on public.budget_items(household_id, archived_at, is_active, type);
create index budget_items_created_by_idx on public.budget_items(created_by);
create index push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

alter table public.budget_items enable row level security;
alter table public.push_subscriptions enable row level security;

create trigger budget_items_touch_updated_at before update on public.budget_items
for each row execute function public.touch_updated_at();

create trigger push_subscriptions_touch_updated_at before update on public.push_subscriptions
for each row execute function public.touch_updated_at();

create policy "Members can view budget items"
on public.budget_items for select
to authenticated
using (public.is_household_member(household_id));

create policy "Members can create budget items"
on public.budget_items for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_household_member(household_id)
);

create policy "Members can update budget items"
on public.budget_items for update
to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

create policy "Members can delete budget items"
on public.budget_items for delete
to authenticated
using (public.is_household_member(household_id));

create policy "Users can view their push subscriptions"
on public.push_subscriptions for select
to authenticated
using (user_id = auth.uid());

create policy "Users can create their push subscriptions"
on public.push_subscriptions for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can update their push subscriptions"
on public.push_subscriptions for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete their push subscriptions"
on public.push_subscriptions for delete
to authenticated
using (user_id = auth.uid());

create or replace function public.notification_body_with_note(p_base text, p_note text)
returns text
language sql
immutable
as $$
  select case
    when nullif(trim(coalesce(p_note, '')), '') is null then p_base
    else p_base || ' - Note: ' || left(trim(p_note), 140)
  end;
$$;

create or replace function public.notify_on_expense_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
  target_user_id uuid;
  category_name text;
  category_limit numeric;
  category_spent numeric;
  body_text text;
begin
  select coalesce(nullif(p.display_name, ''), p.email, 'A household member') into actor_name from public.profiles p where p.id = new.user_id;
  select c.name into category_name from public.categories c where c.id = new.category_id;
  body_text := public.notification_body_with_note(
    coalesce(category_name, 'Category') || ' - $' || to_char(new.amount, 'FM999999990.00'),
    new.note
  );

  for target_user_id in
    select hm.user_id from public.household_members hm
    where hm.household_id = new.household_id and hm.user_id <> new.user_id
  loop
    insert into public.notifications (household_id, user_id, actor_user_id, type, title, body, metadata)
    values (
      new.household_id,
      target_user_id,
      new.user_id,
      'expense_added',
      actor_name || ' added a new expense',
      body_text,
      jsonb_build_object('expense_id', new.id, 'amount', new.amount, 'category_id', new.category_id, 'note', new.note)
    );
  end loop;

  select bl.amount,
         coalesce(sum(e.amount), 0)
  into category_limit, category_spent
  from public.budget_months bm
  join public.budget_limits bl on bl.budget_month_id = bm.id and bl.category_id = new.category_id
  left join public.expenses e on e.household_id = new.household_id and e.category_id = new.category_id
    and date_trunc('month', e.spent_on) = date_trunc('month', new.spent_on)
  where bm.household_id = new.household_id
    and bm.month_start = date_trunc('month', new.spent_on)::date
  group by bl.amount;

  if category_limit is not null and category_limit > 0 then
    if category_spent >= category_limit then
      insert into public.notifications (household_id, user_id, actor_user_id, type, title, body, metadata)
      select new.household_id, hm.user_id, new.user_id, 'budget_overspent',
             coalesce(category_name, 'Category') || ' is overspent',
             'Spent $' || to_char(category_spent, 'FM999999990.00') || ' of $' || to_char(category_limit, 'FM999999990.00'),
             jsonb_build_object('category_id', new.category_id)
      from public.household_members hm
      where hm.household_id = new.household_id
        and hm.user_id <> new.user_id;
    elsif category_spent >= category_limit * 0.8 then
      insert into public.notifications (household_id, user_id, actor_user_id, type, title, body, metadata)
      select new.household_id, hm.user_id, new.user_id, 'budget_warning',
             coalesce(category_name, 'Category') || ' reached 80% of budget',
             'Spent $' || to_char(category_spent, 'FM999999990.00') || ' of $' || to_char(category_limit, 'FM999999990.00'),
             jsonb_build_object('category_id', new.category_id)
      from public.household_members hm
      where hm.household_id = new.household_id
        and hm.user_id <> new.user_id;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.notify_on_expense_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
  target_user_id uuid;
  category_name text;
  body_text text;
begin
  if old.amount is not distinct from new.amount
    and old.category_id is not distinct from new.category_id
    and old.spent_on is not distinct from new.spent_on
    and old.merchant is not distinct from new.merchant
    and old.note is not distinct from new.note then
    return new;
  end if;

  select coalesce(nullif(p.display_name, ''), p.email, 'A household member') into actor_name from public.profiles p where p.id = new.user_id;
  select c.name into category_name from public.categories c where c.id = new.category_id;
  body_text := public.notification_body_with_note(
    coalesce(category_name, 'Category') || ' - $' || to_char(new.amount, 'FM999999990.00'),
    new.note
  );

  for target_user_id in
    select hm.user_id from public.household_members hm
    where hm.household_id = new.household_id and hm.user_id <> new.user_id
  loop
    insert into public.notifications (household_id, user_id, actor_user_id, type, title, body, metadata)
    values (
      new.household_id,
      target_user_id,
      new.user_id,
      'expense_updated',
      actor_name || ' updated an expense',
      body_text,
      jsonb_build_object('expense_id', new.id, 'amount', new.amount, 'category_id', new.category_id, 'note', new.note)
    );
  end loop;

  return new;
end;
$$;

create or replace function public.notify_on_expense_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
  target_user_id uuid;
  category_name text;
  body_text text;
begin
  select coalesce(nullif(p.display_name, ''), p.email, 'A household member') into actor_name from public.profiles p where p.id = old.user_id;
  select c.name into category_name from public.categories c where c.id = old.category_id;
  body_text := public.notification_body_with_note(
    coalesce(category_name, 'Category') || ' - $' || to_char(old.amount, 'FM999999990.00'),
    old.note
  );

  for target_user_id in
    select hm.user_id from public.household_members hm
    where hm.household_id = old.household_id and hm.user_id <> old.user_id
  loop
    insert into public.notifications (household_id, user_id, actor_user_id, type, title, body, metadata)
    values (
      old.household_id,
      target_user_id,
      old.user_id,
      'expense_deleted',
      actor_name || ' deleted an expense',
      body_text,
      jsonb_build_object('expense_id', old.id, 'amount', old.amount, 'category_id', old.category_id, 'note', old.note)
    );
  end loop;

  return old;
end;
$$;

create or replace function public.notify_on_budget_item_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
  target_user_id uuid;
  body_text text;
begin
  select coalesce(nullif(p.display_name, ''), p.email, 'A household member') into actor_name from public.profiles p where p.id = new.created_by;
  body_text := case
    when new.needs_amount or new.amount is null then new.item_name || ' - Needs amount'
    else new.item_name || ' - $' || to_char(new.amount, 'FM999999990.00')
  end;

  for target_user_id in
    select hm.user_id from public.household_members hm
    where hm.household_id = new.household_id and hm.user_id <> new.created_by
  loop
    insert into public.notifications (household_id, user_id, actor_user_id, type, title, body, metadata)
    values (
      new.household_id,
      target_user_id,
      new.created_by,
      'budget_item_added',
      actor_name || ' added a budget item',
      body_text,
      jsonb_build_object('budget_item_id', new.id, 'type', new.type, 'category', new.category)
    );
  end loop;

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
  target_user_id uuid;
  body_text text;
  notification_type text := 'budget_item_updated';
  title_text text;
begin
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

  select coalesce(nullif(p.display_name, ''), p.email, 'A household member') into actor_name from public.profiles p where p.id = auth.uid();

  if new.archived_at is not null and old.archived_at is null then
    notification_type := 'budget_item_deleted';
    title_text := actor_name || ' archived a budget item';
  else
    title_text := actor_name || ' updated a budget item';
  end if;

  body_text := case
    when new.needs_amount or new.amount is null then new.item_name || ' - Needs amount'
    else new.item_name || ' - $' || to_char(new.amount, 'FM999999990.00')
  end;

  for target_user_id in
    select hm.user_id from public.household_members hm
    where hm.household_id = new.household_id and hm.user_id <> auth.uid()
  loop
    insert into public.notifications (household_id, user_id, actor_user_id, type, title, body, metadata)
    values (
      new.household_id,
      target_user_id,
      auth.uid(),
      notification_type,
      title_text,
      body_text,
      jsonb_build_object('budget_item_id', new.id, 'type', new.type, 'category', new.category)
    );
  end loop;

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
  target_user_id uuid;
begin
  select coalesce(nullif(p.display_name, ''), p.email, 'A household member') into actor_name from public.profiles p where p.id = auth.uid();

  for target_user_id in
    select hm.user_id from public.household_members hm
    where hm.household_id = old.household_id and hm.user_id <> auth.uid()
  loop
    insert into public.notifications (household_id, user_id, actor_user_id, type, title, body, metadata)
    values (
      old.household_id,
      target_user_id,
      auth.uid(),
      'budget_item_deleted',
      actor_name || ' deleted a budget item',
      old.item_name,
      jsonb_build_object('budget_item_id', old.id, 'type', old.type, 'category', old.category)
    );
  end loop;

  return old;
end;
$$;

drop trigger if exists expenses_notify_household on public.expenses;
create trigger expenses_notify_household after insert on public.expenses
for each row execute function public.notify_on_expense_insert();

drop trigger if exists expenses_update_notify_household on public.expenses;
create trigger expenses_update_notify_household after update on public.expenses
for each row execute function public.notify_on_expense_update();

drop trigger if exists expenses_delete_notify_household on public.expenses;
create trigger expenses_delete_notify_household after delete on public.expenses
for each row execute function public.notify_on_expense_delete();

create trigger budget_items_insert_notify_household after insert on public.budget_items
for each row execute function public.notify_on_budget_item_insert();

create trigger budget_items_update_notify_household after update on public.budget_items
for each row execute function public.notify_on_budget_item_update();

create trigger budget_items_delete_notify_household after delete on public.budget_items
for each row execute function public.notify_on_budget_item_delete();

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.expenses;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.budget_items;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
