do $$
begin
  if to_regclass('public.planned_budget_items') is null then
    return;
  end if;

  alter table public.planned_budget_items
    add column if not exists item_name text,
    add column if not exists type text default 'variable',
    add column if not exists start_date date;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'planned_budget_items' and column_name = 'item_name'
  ) and exists (
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
    where table_schema = 'public' and table_name = 'planned_budget_items' and column_name = 'type'
  ) and exists (
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
    where table_schema = 'public' and table_name = 'planned_budget_items' and column_name = 'start_date'
  ) and exists (
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
