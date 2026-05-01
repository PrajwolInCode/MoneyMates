create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  type text not null,
  title text not null,
  body text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.expense_comments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expense_comment_body_length check (char_length(trim(body)) between 1 and 500)
);

create index notifications_user_unread_idx on public.notifications(user_id, read_at, created_at desc);
create index notifications_household_idx on public.notifications(household_id, created_at desc);
create index expense_comments_expense_idx on public.expense_comments(expense_id, created_at asc);

alter table public.notifications enable row level security;
alter table public.expense_comments enable row level security;

create policy "Users can view household notifications addressed to them"
on public.notifications for select
to authenticated
using (user_id = auth.uid() and public.is_household_member(household_id));

create policy "System and members can create household notifications"
on public.notifications for insert
to authenticated
with check (public.is_household_member(household_id));

create policy "Users can mark their own notifications"
on public.notifications for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Members can view expense comments"
on public.expense_comments for select
to authenticated
using (public.is_household_member(household_id));

create policy "Members can add expense comments"
on public.expense_comments for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_household_member(household_id)
  and exists (
    select 1 from public.expenses e
    where e.id = expense_id
      and e.household_id = expense_comments.household_id
  )
);

create policy "Users can update their own expense comments"
on public.expense_comments for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create trigger expense_comments_touch_updated_at before update on public.expense_comments
for each row execute function public.touch_updated_at();

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
begin
  select coalesce(nullif(p.display_name, ''), p.email, 'Your partner') into actor_name from public.profiles p where p.id = new.user_id;
  select c.name into category_name from public.categories c where c.id = new.category_id;

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
      coalesce(category_name, 'Category') || ' · $' || to_char(new.amount, 'FM999999990.00'),
      jsonb_build_object('expense_id', new.id, 'amount', new.amount, 'category_id', new.category_id)
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
      from public.household_members hm where hm.household_id = new.household_id;
    elsif category_spent >= category_limit * 0.8 then
      insert into public.notifications (household_id, user_id, actor_user_id, type, title, body, metadata)
      select new.household_id, hm.user_id, new.user_id, 'budget_warning',
             coalesce(category_name, 'Category') || ' reached 80% of budget',
             'Spent $' || to_char(category_spent, 'FM999999990.00') || ' of $' || to_char(category_limit, 'FM999999990.00'),
             jsonb_build_object('category_id', new.category_id)
      from public.household_members hm where hm.household_id = new.household_id;
    end if;
  end if;

  return new;
end;
$$;

create trigger expenses_notify_household after insert on public.expenses
for each row execute function public.notify_on_expense_insert();

create or replace function public.notify_on_ai_insight_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (household_id, user_id, actor_user_id, type, title, body, metadata)
  select new.household_id, hm.user_id, new.created_by, 'ai_insight',
         'AI Budget Coach generated a new suggestion',
         new.summary,
         jsonb_build_object('insight_id', new.id)
  from public.household_members hm
  where hm.household_id = new.household_id;
  return new;
end;
$$;

create trigger ai_insights_notify_household after insert on public.ai_insights
for each row execute function public.notify_on_ai_insight_insert();
