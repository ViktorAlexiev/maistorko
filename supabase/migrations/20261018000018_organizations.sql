-- Companies ("фирми"): an organization with an owner, optional managers (dispatchers) and craftsmen.
-- Every person keeps a personal account and personal profile; reviews and photos stay with the craftsman.
-- Accounts are created through invitations: the company prepares a name, the person opens the link and sets a password.
-- A person belongs to at most one company at a time.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null check (char_length(name) between 2 and 120),
  eik text check (eik ~ '^[0-9]{9,13}$'),
  description text check (char_length(description) <= 1000),
  city_id smallint references public.cities (id),
  phone text check (char_length(phone) <= 40),
  is_verified boolean not null default false,
  is_hidden boolean not null default false,
  plan_status text not null default 'active' check (plan_status in ('active', 'paused')),
  plan_valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'craftsman')),
  joined_at timestamptz not null default now(),
  primary key (organization_id, user_id),
  unique (user_id)
);
create index organization_members_user_idx on public.organization_members (user_id);

create table public.organization_invites (
  token uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role text not null default 'craftsman' check (role in ('owner', 'manager', 'craftsman')),
  full_name text check (char_length(full_name) <= 120),
  email text check (char_length(email) <= 200),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  used_by uuid references public.profiles (id) on delete set null,
  used_at timestamptz
);
create index organization_invites_org_idx on public.organization_invites (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.org_role(p_org uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.organization_members m where m.organization_id = p_org and m.user_id = (select auth.uid())
$$;

create or replace function public.is_org_member(p_org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select public.org_role(p_org) is not null $$;

create or replace function public.is_org_manager(p_org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(public.org_role(p_org) in ('owner', 'manager'), false) and not public.is_banned() $$;

-- The craftsman himself, or a manager/owner of the company he works for
create or replace function public.can_manage_craftsman(p_craftsman uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_craftsman = (select auth.uid())
      or exists (
        select 1
        from public.organization_members me
        join public.organization_members him on him.organization_id = me.organization_id
        where me.user_id = (select auth.uid()) and me.role in ('owner', 'manager')
          and him.user_id = p_craftsman and him.role = 'craftsman'
      )
$$;

-- Active company plan?
create or replace function public.org_plan_active(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organizations o
    where o.id = p_org and o.plan_status = 'active' and (o.plan_valid_until is null or o.plan_valid_until > now())
  )
$$;

-- A craftsman in a company with an active plan gets the company plan
create or replace function public.craftsman_plan(p_craftsman uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select 'company' from public.organization_members m
     where m.user_id = p_craftsman and public.org_plan_active(m.organization_id)),
    (select s.plan from public.craftsman_subscriptions s
     where s.craftsman_id = p_craftsman and s.status = 'active' and (s.valid_until is null or s.valid_until > now())),
    'free')
$$;

create or replace function public.unique_org_slug(p_name text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_base text := coalesce(nullif(public.slugify(p_name), ''), 'firma');
  v_slug text := v_base;
  n integer := 1;
begin
  while exists (select 1 from public.organizations where slug = v_slug) loop
    n := n + 1;
    v_slug := v_base || '-' || n;
  end loop;
  return v_slug;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invites enable row level security;

create policy "organizations: public read" on public.organizations
  for select to anon, authenticated
  using (not is_hidden or public.is_org_member(id) or public.is_admin());
create policy "organizations: managers update" on public.organizations
  for update to authenticated
  using (public.is_org_manager(id)) with check (public.is_org_manager(id));

create policy "members: read" on public.organization_members
  for select to anon, authenticated
  using (
    user_id = (select auth.uid())
    or public.is_org_member(organization_id)
    or public.is_admin()
    or (public.craftsman_is_listed(user_id)
        and exists (select 1 from public.organizations o where o.id = organization_id and not o.is_hidden))
  );

create policy "invites: managers read" on public.organization_invites
  for select to authenticated using (public.is_org_manager(organization_id) or public.is_admin());

revoke all on public.organizations, public.organization_members, public.organization_invites from anon, authenticated;
grant select on public.organizations, public.organization_members to anon, authenticated;
grant update (name, description, city_id, phone) on public.organizations to authenticated;
grant select on public.organization_invites to authenticated;

-- Company-wide protected columns cannot be changed through the API by managers
create or replace function public.protect_org_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_api_request() and not public.is_admin() then
    new.slug := old.slug;
    new.eik := old.eik;
    new.is_verified := old.is_verified;
    new.is_hidden := old.is_hidden;
    new.plan_status := old.plan_status;
    new.plan_valid_until := old.plan_valid_until;
  end if;
  return new;
end;
$$;
create trigger organizations_protect before update on public.organizations
  for each row execute function public.protect_org_columns();

-- A manager may edit the calendar of the craftsmen in his company, and read it even when the craftsman is not public yet
drop policy "availability rules: public read" on public.availability_rules;
drop policy "availability rules: owner write" on public.availability_rules;
create policy "availability rules: public read" on public.availability_rules
  for select to anon, authenticated
  using (public.craftsman_is_public(craftsman_id) or public.can_manage_craftsman(craftsman_id) or public.is_admin());
create policy "availability rules: owner write" on public.availability_rules
  for all to authenticated
  using (public.owns_craftsman(craftsman_id) or (public.can_manage_craftsman(craftsman_id) and not public.is_banned()))
  with check (public.owns_craftsman(craftsman_id) or (public.can_manage_craftsman(craftsman_id) and not public.is_banned()));

drop policy "availability exceptions: public read" on public.availability_exceptions;
drop policy "availability exceptions: owner write" on public.availability_exceptions;
create policy "availability exceptions: public read" on public.availability_exceptions
  for select to anon, authenticated
  using (public.craftsman_is_public(craftsman_id) or public.can_manage_craftsman(craftsman_id) or public.is_admin());
create policy "availability exceptions: owner write" on public.availability_exceptions
  for all to authenticated
  using (public.owns_craftsman(craftsman_id) or (public.can_manage_craftsman(craftsman_id) and not public.is_banned()))
  with check (public.owns_craftsman(craftsman_id) or (public.can_manage_craftsman(craftsman_id) and not public.is_banned()));

-- ---------------------------------------------------------------------------
-- Admin: create a company and hand it to its owner (after the deal made through "За фирми")
-- ---------------------------------------------------------------------------
create or replace function public.admin_create_org(p_name text, p_eik text default null, p_city text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_slug text;
  v_token uuid;
  v_city smallint;
begin
  if not public.is_admin() then raise exception 'Нямате администраторски права.' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_name, ''))) < 2 then raise exception 'Напишете името на фирмата.'; end if;
  if p_city is not null and p_city <> '' then select id into v_city from public.cities where slug = p_city; end if;
  v_slug := public.unique_org_slug(p_name);
  insert into public.organizations (slug, name, eik, city_id)
  values (v_slug, btrim(p_name), nullif(btrim(coalesce(p_eik, '')), ''), v_city)
  returning id into v_id;
  insert into public.organization_invites (organization_id, role, created_by)
  values (v_id, 'owner', auth.uid()) returning token into v_token;
  return jsonb_build_object('id', v_id, 'slug', v_slug, 'owner_token', v_token);
end;
$$;

create or replace function public.admin_set_org_owner(p_org uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid;
begin
  if not public.is_admin() then raise exception 'Нямате администраторски права.' using errcode = '42501'; end if;
  select u.id into v_user from auth.users u where lower(u.email) = lower(btrim(p_email));
  if v_user is null then raise exception 'Няма потребител с този имейл.'; end if;
  if exists (select 1 from public.organization_members where user_id = v_user) then
    raise exception 'Този човек вече е във фирма.';
  end if;
  insert into public.organization_members (organization_id, user_id, role) values (p_org, v_user, 'owner');
end;
$$;

create or replace function public.admin_update_org(
  p_org uuid, p_verified boolean default null, p_hidden boolean default null,
  p_plan_status text default null, p_plan_until timestamptz default null, p_clear_until boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Нямате администраторски права.' using errcode = '42501'; end if;
  if p_plan_status is not null and p_plan_status not in ('active', 'paused') then raise exception 'Невалиден статус.'; end if;
  update public.organizations set
    is_verified = coalesce(p_verified, is_verified),
    is_hidden = coalesce(p_hidden, is_hidden),
    plan_status = coalesce(p_plan_status, plan_status),
    plan_valid_until = case when p_clear_until then null else coalesce(p_plan_until, plan_valid_until) end
  where id = p_org;
end;
$$;

-- ---------------------------------------------------------------------------
-- Owners and managers: invitations and members
-- ---------------------------------------------------------------------------
create or replace function public.create_org_invite(p_full_name text default null, p_email text default null, p_role text default 'craftsman')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_role text;
  v_token uuid;
begin
  select m.organization_id, m.role into v_org, v_role from public.organization_members m where m.user_id = auth.uid();
  if v_org is null or v_role not in ('owner', 'manager') or public.is_banned() then
    raise exception 'Само собственик или мениджър на фирма може да кани.' using errcode = '42501';
  end if;
  if p_role not in ('manager', 'craftsman') then raise exception 'Невалидна роля.'; end if;
  if p_role = 'manager' and v_role <> 'owner' then raise exception 'Мениджър може да добавя само собственикът.' using errcode = '42501'; end if;
  if (select count(*) from public.organization_invites where organization_id = v_org and used_at is null and expires_at > now()) >= 100 then
    raise exception 'Има твърде много неизползвани покани.';
  end if;
  insert into public.organization_invites (organization_id, role, full_name, email, created_by)
  values (v_org, p_role, nullif(btrim(coalesce(p_full_name, '')), ''), nullif(btrim(coalesce(p_email, '')), ''), auth.uid())
  returning token into v_token;
  return v_token;
end;
$$;

create or replace function public.revoke_org_invite(p_token uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.organization_invites i
  where i.token = p_token and i.used_at is null and public.is_org_manager(i.organization_id);
end;
$$;

-- What the public invitation page may show
create or replace function public.org_invite_info(p_token uuid)
returns table (org_name text, org_slug text, role text, full_name text, state text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name, o.slug, i.role, i.full_name,
         case when i.used_at is not null then 'used' when i.expires_at < now() then 'expired' else 'open' end
  from public.organization_invites i join public.organizations o on o.id = i.organization_id
  where i.token = p_token
$$;

-- The invited person accepts (signed in). A craftsman gets a craftsman profile with the prepared name.
create or replace function public.claim_org_invite(p_token uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  i public.organization_invites;
  v_slug text;
  v_existed boolean;
begin
  if v_me is null then raise exception 'Влезте в профила си, за да приемете.' using errcode = '42501'; end if;
  if public.is_banned() then raise exception 'Профилът ви е блокиран.' using errcode = '42501'; end if;
  select * into i from public.organization_invites where token = p_token for update;
  if i.token is null then raise exception 'Поканата не е валидна.'; end if;
  if i.used_at is not null then raise exception 'Тази покана вече е използвана.'; end if;
  if i.expires_at < now() then raise exception 'Поканата е изтекла.'; end if;
  if exists (select 1 from public.organization_members where user_id = v_me) then
    raise exception 'Вече сте във фирма. Напуснете я, за да приемете друга покана.';
  end if;
  if not public.org_plan_active(i.organization_id) and i.role <> 'owner' then
    raise exception 'Фирмата няма активен план.';
  end if;

  if i.role = 'craftsman' then
    v_existed := exists (select 1 from public.craftsman_profiles where id = v_me);
    perform public.become_craftsman();
    -- the prepared name is used for a profile that this invitation creates; an existing profile keeps its own name
    if i.full_name is not null and not v_existed then
      update public.craftsman_profiles set display_name = i.full_name where id = v_me;
      update public.profiles set full_name = i.full_name where id = v_me and coalesce(full_name, '') = '';
    end if;
  end if;

  insert into public.organization_members (organization_id, user_id, role) values (i.organization_id, v_me, i.role);
  update public.organization_invites set used_by = v_me, used_at = now() where token = p_token;
  select o.slug into v_slug from public.organizations o where o.id = i.organization_id;
  return v_slug;
end;
$$;

create or replace function public.remove_org_member(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_my_role text;
  v_their_role text;
begin
  select m.organization_id, m.role into v_org, v_my_role from public.organization_members m where m.user_id = auth.uid();
  if v_org is null or v_my_role not in ('owner', 'manager') then
    raise exception 'Нямате право.' using errcode = '42501';
  end if;
  select m.role into v_their_role from public.organization_members m where m.organization_id = v_org and m.user_id = p_user;
  if v_their_role is null then raise exception 'Този човек не е във вашата фирма.'; end if;
  if p_user = auth.uid() then raise exception 'За да напуснете, използвайте „Напусни фирмата“.'; end if;
  if v_their_role = 'owner' then raise exception 'Собственикът не може да бъде махнат.' using errcode = '42501'; end if;
  if v_their_role = 'manager' and v_my_role <> 'owner' then raise exception 'Мениджър може да бъде махнат само от собственика.' using errcode = '42501'; end if;
  delete from public.organization_members where organization_id = v_org and user_id = p_user;
end;
$$;

create or replace function public.leave_org()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.organization_members where user_id = auth.uid() and role = 'owner') then
    raise exception 'Собственикът не може да напусне. Свържете се с нас, за да предадете фирмата.';
  end if;
  delete from public.organization_members where user_id = auth.uid();
end;
$$;

create or replace function public.set_member_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_org uuid;
begin
  select m.organization_id into v_org from public.organization_members m where m.user_id = auth.uid() and m.role = 'owner';
  if v_org is null then raise exception 'Само собственикът сменя роли.' using errcode = '42501'; end if;
  if p_role not in ('manager', 'craftsman') then raise exception 'Невалидна роля.'; end if;
  update public.organization_members set role = p_role
  where organization_id = v_org and user_id = p_user and role <> 'owner';
  if not found then raise exception 'Този човек не е във вашата фирма.'; end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function
  public.org_role(uuid), public.is_org_member(uuid), public.is_org_manager(uuid), public.org_plan_active(uuid),
  public.can_manage_craftsman(uuid), public.craftsman_plan(uuid), public.unique_org_slug(text),
  public.protect_org_columns(),
  public.admin_create_org(text, text, text), public.admin_set_org_owner(uuid, text),
  public.admin_update_org(uuid, boolean, boolean, text, timestamptz, boolean),
  public.create_org_invite(text, text, text), public.revoke_org_invite(uuid), public.org_invite_info(uuid),
  public.claim_org_invite(uuid), public.remove_org_member(uuid), public.leave_org(), public.set_member_role(uuid, text)
  from public, anon, authenticated;

-- used inside RLS policies, so the API roles must be able to run them
grant execute on function public.org_role(uuid), public.is_org_member(uuid), public.is_org_manager(uuid),
  public.can_manage_craftsman(uuid), public.org_plan_active(uuid) to anon, authenticated;
grant execute on function public.craftsman_plan(uuid) to anon, authenticated;
grant execute on function public.org_invite_info(uuid) to anon, authenticated;
grant execute on function
  public.admin_create_org(text, text, text), public.admin_set_org_owner(uuid, text),
  public.admin_update_org(uuid, boolean, boolean, text, timestamptz, boolean),
  public.create_org_invite(text, text, text), public.revoke_org_invite(uuid), public.claim_org_invite(uuid),
  public.remove_org_member(uuid), public.leave_org(), public.set_member_role(uuid, text)
  to authenticated;

-- A fresh owner invitation for an existing company (lost link, change of owner)
create or replace function public.admin_owner_invite(p_org uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_token uuid;
begin
  if not public.is_admin() then raise exception 'Нямате администраторски права.' using errcode = '42501'; end if;
  insert into public.organization_invites (organization_id, role, created_by)
  values (p_org, 'owner', auth.uid()) returning token into v_token;
  return v_token;
end;
$$;
revoke execute on function public.admin_owner_invite(uuid) from public, anon, authenticated;
grant execute on function public.admin_owner_invite(uuid) to authenticated;

-- The team of my company with what a manager needs at a glance (names even for people with no public profile)
create or replace function public.org_team()
returns table (user_id uuid, role text, name text, slug text, avatar_url text, joined_at timestamptz,
               last_confirmed_at timestamptz, next_free date)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, m.role,
         coalesce(nullif(cp.display_name, ''), nullif(p.full_name, ''), 'Без име'),
         cp.slug, coalesce(cp.avatar_url, p.avatar_url), m.joined_at, cp.last_confirmed_at,
         case when cp.id is not null then public.next_free_date(cp.id, (now() at time zone 'Europe/Sofia')::date, 30) end
  from public.organization_members m
  join public.profiles p on p.id = m.user_id
  left join public.craftsman_profiles cp on cp.id = m.user_id
  where m.organization_id = (select x.organization_id from public.organization_members x where x.user_id = auth.uid())
  order by case m.role when 'owner' then 0 when 'manager' then 1 else 2 end, m.joined_at
$$;
revoke execute on function public.org_team() from public, anon, authenticated;
grant execute on function public.org_team() to authenticated;
