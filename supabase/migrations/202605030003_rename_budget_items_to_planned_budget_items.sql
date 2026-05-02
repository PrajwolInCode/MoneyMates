do $$
begin
  if to_regclass('public.planned_budget_items') is null and to_regclass('public.budget_items') is not null then
    alter table public.budget_items rename to planned_budget_items;
  end if;
end $$;

alter index if exists budget_items_household_active_idx rename to planned_budget_items_household_active_idx;
alter index if exists budget_items_created_by_idx rename to planned_budget_items_created_by_idx;

do $$
begin
  if exists (
    select 1 from pg_trigger
    where tgname = 'budget_items_touch_updated_at'
      and tgrelid = 'public.planned_budget_items'::regclass
  ) then
    alter trigger budget_items_touch_updated_at on public.planned_budget_items rename to planned_budget_items_touch_updated_at;
  end if;

  if exists (
    select 1 from pg_trigger
    where tgname = 'budget_items_insert_notify_household'
      and tgrelid = 'public.planned_budget_items'::regclass
  ) then
    alter trigger budget_items_insert_notify_household on public.planned_budget_items rename to planned_budget_items_insert_notify_household;
  end if;

  if exists (
    select 1 from pg_trigger
    where tgname = 'budget_items_update_notify_household'
      and tgrelid = 'public.planned_budget_items'::regclass
  ) then
    alter trigger budget_items_update_notify_household on public.planned_budget_items rename to planned_budget_items_update_notify_household;
  end if;

  if exists (
    select 1 from pg_trigger
    where tgname = 'budget_items_delete_notify_household'
      and tgrelid = 'public.planned_budget_items'::regclass
  ) then
    alter trigger budget_items_delete_notify_household on public.planned_budget_items rename to planned_budget_items_delete_notify_household;
  end if;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.planned_budget_items;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
