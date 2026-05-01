create or replace function public.join_household_by_code(p_join_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_household_id uuid;
  joining_user_id uuid := auth.uid();
  joining_email text;
  normalized_join_code text := regexp_replace(upper(coalesce(p_join_code, '')), '[^A-Z0-9]', '', 'g');
begin
  if joining_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if length(normalized_join_code) < 6 then
    raise exception 'Invalid join code';
  end if;

  select h.id
  into target_household_id
  from public.households h
  where h.join_code = normalized_join_code;

  if target_household_id is null then
    raise exception 'Invalid join code';
  end if;

  select coalesce(u.email, '')
  into joining_email
  from auth.users u
  where u.id = joining_user_id;

  insert into public.profiles (id, display_name, email)
  values (
    joining_user_id,
    coalesce(nullif(split_part(joining_email, '@', 1), ''), 'Housemate'),
    coalesce(joining_email, '')
  )
  on conflict (id) do update
    set email = coalesce(nullif(excluded.email, ''), public.profiles.email),
        display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name);

  insert into public.household_members (household_id, user_id, role)
  values (target_household_id, joining_user_id, 'member')
  on conflict (household_id, user_id) do nothing;

  return target_household_id;
end;
$$;

grant execute on function public.join_household_by_code(text) to authenticated;
