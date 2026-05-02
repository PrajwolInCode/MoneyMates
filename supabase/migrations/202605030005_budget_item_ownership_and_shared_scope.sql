do $$
begin
  if to_regclass('public.planned_budget_items') is not null then
    alter table public.planned_budget_items
      add column if not exists owner_user_id uuid;

    alter table public.planned_budget_items
      add column if not exists payer_user_id uuid;

    alter table public.planned_budget_items
      add column if not exists scope text;

    update public.planned_budget_items
    set owner_user_id = created_by
    where owner_user_id is null
      and created_by is not null;

    update public.planned_budget_items
    set payer_user_id = owner_user_id
    where payer_user_id is null
      and owner_user_id is not null
      and coalesce(scope, item_scope, 'personal') = 'personal';

    update public.planned_budget_items
    set scope = coalesce(item_scope, 'personal')
    where scope is null;

    alter table public.planned_budget_items
      alter column scope set default 'personal';

    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.planned_budget_items'::regclass
        and conname = 'planned_budget_items_scope_check'
    ) then
      alter table public.planned_budget_items
        add constraint planned_budget_items_scope_check
        check (scope in ('personal', 'shared')) not valid;
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.planned_budget_items'::regclass
        and conname = 'planned_budget_items_owner_user_id_fkey'
    ) then
      alter table public.planned_budget_items
        add constraint planned_budget_items_owner_user_id_fkey
        foreign key (owner_user_id) references public.profiles(id) on delete set null not valid;
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.planned_budget_items'::regclass
        and conname = 'planned_budget_items_payer_user_id_fkey'
    ) then
      alter table public.planned_budget_items
        add constraint planned_budget_items_payer_user_id_fkey
        foreign key (payer_user_id) references public.profiles(id) on delete set null not valid;
    end if;

    create index if not exists planned_budget_items_household_scope_active_idx
      on public.planned_budget_items(household_id, scope, is_active, archived_at);

    create index if not exists planned_budget_items_owner_user_id_idx
      on public.planned_budget_items(owner_user_id);

    create index if not exists planned_budget_items_payer_user_id_idx
      on public.planned_budget_items(payer_user_id);
  end if;
end $$;

do $$
begin
  if to_regclass('public.budget_items') is not null then
    alter table public.budget_items
      add column if not exists owner_user_id uuid;

    alter table public.budget_items
      add column if not exists payer_user_id uuid;

    alter table public.budget_items
      add column if not exists scope text;

    update public.budget_items
    set owner_user_id = created_by
    where owner_user_id is null
      and created_by is not null;

    update public.budget_items
    set payer_user_id = owner_user_id
    where payer_user_id is null
      and owner_user_id is not null
      and coalesce(scope, item_scope, 'personal') = 'personal';

    update public.budget_items
    set scope = coalesce(item_scope, 'personal')
    where scope is null;

    alter table public.budget_items
      alter column scope set default 'personal';

    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.budget_items'::regclass
        and conname = 'budget_items_scope_check'
    ) then
      alter table public.budget_items
        add constraint budget_items_scope_check
        check (scope in ('personal', 'shared')) not valid;
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.budget_items'::regclass
        and conname = 'budget_items_owner_user_id_fkey'
    ) then
      alter table public.budget_items
        add constraint budget_items_owner_user_id_fkey
        foreign key (owner_user_id) references public.profiles(id) on delete set null not valid;
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.budget_items'::regclass
        and conname = 'budget_items_payer_user_id_fkey'
    ) then
      alter table public.budget_items
        add constraint budget_items_payer_user_id_fkey
        foreign key (payer_user_id) references public.profiles(id) on delete set null not valid;
    end if;

    create index if not exists budget_items_household_scope_active_idx
      on public.budget_items(household_id, scope, is_active, archived_at);

    create index if not exists budget_items_owner_user_id_idx
      on public.budget_items(owner_user_id);

    create index if not exists budget_items_payer_user_id_idx
      on public.budget_items(payer_user_id);
  end if;
end $$;
