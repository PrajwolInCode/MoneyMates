create or replace function public.notify_on_household_member_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (household_id, user_id, actor_user_id, type, title, body, metadata)
  select
    new.household_id,
    hm.user_id,
    new.user_id,
    'partner_joined',
    'Member joined',
    'A household member joined.',
    jsonb_build_object('member_user_id', new.user_id)
  from public.household_members hm
  where hm.household_id = new.household_id
    and hm.user_id <> new.user_id;

  return new;
end;
$$;

drop trigger if exists household_members_notify_join on public.household_members;
create trigger household_members_notify_join
after insert on public.household_members
for each row execute function public.notify_on_household_member_insert();

create or replace function public.notify_on_budget_setup_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.budget_setup_completed_at is null and new.budget_setup_completed_at is not null then
    insert into public.notifications (household_id, user_id, actor_user_id, type, title, body, metadata)
    select
      new.household_id,
      hm.user_id,
      new.user_id,
      'budget_setup_completed',
      'Budget setup complete',
      'A household member completed their part.',
      jsonb_build_object('member_user_id', new.user_id)
    from public.household_members hm
    where hm.household_id = new.household_id
      and hm.user_id <> new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists household_members_notify_setup_completed on public.household_members;
create trigger household_members_notify_setup_completed
after update on public.household_members
for each row execute function public.notify_on_budget_setup_completed();

create or replace function public.notify_on_expense_comment_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (household_id, user_id, actor_user_id, type, title, body, metadata)
  select
    new.household_id,
    hm.user_id,
    new.user_id,
    'comment_added',
    'Comment added',
    left(new.body, 120),
    jsonb_build_object('expense_id', new.expense_id, 'comment_id', new.id)
  from public.household_members hm
  where hm.household_id = new.household_id
    and hm.user_id <> new.user_id;

  return new;
end;
$$;

drop trigger if exists expense_comments_notify_household on public.expense_comments;
create trigger expense_comments_notify_household
after insert on public.expense_comments
for each row execute function public.notify_on_expense_comment_insert();
