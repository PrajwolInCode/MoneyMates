do $$
begin
  if to_regclass('public.planned_budget_items') is not null then
    alter table public.planned_budget_items
      add column if not exists owner_user_id uuid references auth.users(id),
      add column if not exists payer_user_id uuid references auth.users(id),
      add column if not exists scope text not null default 'personal';

    update public.planned_budget_items
      set owner_user_id = coalesce(owner_user_id, created_by)
      where owner_user_id is null;

    update public.planned_budget_items
      set scope = coalesce(nullif(scope, ''), item_scope, 'personal')
      where scope is null or scope = '';

    alter table public.planned_budget_items enable row level security;

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
  end if;

  if to_regclass('public.budget_items') is not null then
    alter table public.budget_items
      add column if not exists owner_user_id uuid references auth.users(id),
      add column if not exists payer_user_id uuid references auth.users(id),
      add column if not exists scope text not null default 'personal';

    update public.budget_items
      set owner_user_id = coalesce(owner_user_id, created_by)
      where owner_user_id is null;

    alter table public.budget_items enable row level security;

    if exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'budget_items' and policyname = 'Members can create budget items'
    ) then
      alter policy "Members can create budget items"
      on public.budget_items
      with check (public.is_household_member(household_id) and created_by = auth.uid());
    else
      create policy "Members can create budget items"
      on public.budget_items for insert
      to authenticated
      with check (public.is_household_member(household_id) and created_by = auth.uid());
    end if;

    if exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'budget_items' and policyname = 'Members can update budget items'
    ) then
      alter policy "Members can update budget items"
      on public.budget_items
      using (public.is_household_member(household_id))
      with check (public.is_household_member(household_id));
    else
      create policy "Members can update budget items"
      on public.budget_items for update
      to authenticated
      using (public.is_household_member(household_id))
      with check (public.is_household_member(household_id));
    end if;
  end if;
end $$;
