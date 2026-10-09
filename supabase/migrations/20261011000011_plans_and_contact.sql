-- Plans and limits (freemium), plus contact requests ("За фирми", "Искам Pro").
-- No payments here: a plan is granted by an admin (source 'admin') for now; the same table
-- will later be filled by a payment provider (source 'payment') or by a company (source 'company').

create table public.plans (
  key text primary key,
  name text not null,
  price_month numeric(8,2) not null default 0 check (price_month >= 0),
  -- a key that is absent means "unlimited"
  limits jsonb not null default '{}',
  features text[] not null default '{}',
  sort smallint not null default 0
);

insert into public.plans (key, name, price_month, limits, features, sort) values
  ('free', 'Безплатен', 0, '{"services": 8, "photos": 6, "cities": 3}', '{}', 1),
  ('pro', 'Pro', 12, '{}',
   '{job_details,client_cards,reports,stats_detail,quick_replies,calendar_export_plus}', 2),
  ('company', 'Фирма', 0, '{}',
   '{job_details,client_cards,reports,stats_detail,quick_replies,calendar_export_plus,team}', 3);

alter table public.plans enable row level security;
create policy "plans are public" on public.plans for select using (true);
revoke all on public.plans from anon, authenticated;
grant select on public.plans to anon, authenticated;

create table public.craftsman_subscriptions (
  craftsman_id uuid primary key references public.craftsman_profiles (id) on delete cascade,
  plan text not null references public.plans (key),
  status text not null default 'active' check (status in ('active', 'paused', 'canceled')),
  valid_until timestamptz,
  source text not null default 'admin' check (source in ('admin', 'payment', 'company')),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger craftsman_subscriptions_updated before update on public.craftsman_subscriptions
  for each row execute function public.set_updated_at();

alter table public.craftsman_subscriptions enable row level security;
create policy "owner reads own subscription" on public.craftsman_subscriptions
  for select to authenticated using (craftsman_id = (select auth.uid()) or public.is_admin());
revoke all on public.craftsman_subscriptions from anon, authenticated;
grant select on public.craftsman_subscriptions to authenticated;

-- ---------------------------------------------------------------------------
-- Which plan, which limit, which feature
-- ---------------------------------------------------------------------------
create or replace function public.craftsman_plan(p_craftsman uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select s.plan from public.craftsman_subscriptions s
    where s.craftsman_id = p_craftsman and s.status = 'active'
      and (s.valid_until is null or s.valid_until > now())
  ), 'free')
$$;

-- NULL means unlimited
create or replace function public.plan_limit(p_craftsman uuid, p_key text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (p.limits ->> p_key)::integer
  from public.plans p
  where p.key = public.craftsman_plan(p_craftsman)
$$;

create or replace function public.has_feature(p_craftsman uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.plans p
    where p.key = public.craftsman_plan(p_craftsman) and p_feature = any (p.features)
  )
$$;

-- Everything the UI needs about the signed-in craftsman's plan and usage
create or replace function public.my_plan()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'plan', p.key,
    'name', p.name,
    'price_month', p.price_month,
    'limits', p.limits,
    'features', to_jsonb(p.features),
    'valid_until', (select s.valid_until from public.craftsman_subscriptions s where s.craftsman_id = auth.uid()),
    'usage', jsonb_build_object(
      'services', (select count(*) from public.services where craftsman_id = auth.uid()),
      'photos', (select count(*) from public.work_photos where craftsman_id = auth.uid()),
      'cities', 1 + (select count(*) from public.craftsman_service_areas where craftsman_id = auth.uid())
    )
  )
  from public.plans p
  where auth.uid() is not null and p.key = public.craftsman_plan(auth.uid())
$$;

-- ---------------------------------------------------------------------------
-- Limits are enforced here, not only in the UI. Seed and admin scripts (not API roles) are exempt,
-- and existing rows are never removed when a limit is lowered.
-- ---------------------------------------------------------------------------
-- Not security definer on purpose: is_api_request() looks at current_user, which must stay the API role.
create or replace function public.enforce_plan_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_key text := tg_argv[0];
  v_limit integer;
  v_count integer;
  v_what text;
begin
  if not public.is_api_request() then return new; end if;
  v_limit := public.plan_limit(new.craftsman_id, v_key);
  if v_limit is null then return new; end if;

  execute format('select count(*) from %I.%I where craftsman_id = $1', tg_table_schema, tg_table_name)
    into v_count using new.craftsman_id;
  -- the main city counts as one of the cities
  if v_key = 'cities' then v_count := v_count + 1; end if;

  if v_count >= v_limit then
    v_what := case v_key
      when 'services' then 'услуги в ценоразписа'
      when 'photos' then 'снимки от работа'
      else 'града, в които работите' end;
    raise exception 'Безплатният план позволява до % %. С Pro няма ограничение.', v_limit, v_what
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger services_plan_limit before insert on public.services
  for each row execute function public.enforce_plan_limit('services');
create trigger work_photos_plan_limit before insert on public.work_photos
  for each row execute function public.enforce_plan_limit('photos');
create trigger service_areas_plan_limit before insert on public.craftsman_service_areas
  for each row execute function public.enforce_plan_limit('cities');

-- ---------------------------------------------------------------------------
-- Admin: grant or end a plan by hand
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_plan(p_craftsman uuid, p_plan text, p_valid_until timestamptz default null, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Нямате администраторски права.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.plans where key = p_plan) then
    raise exception 'Непознат план.';
  end if;
  if p_plan = 'free' then
    delete from public.craftsman_subscriptions where craftsman_id = p_craftsman;
  else
    insert into public.craftsman_subscriptions (craftsman_id, plan, status, valid_until, source, note)
    values (p_craftsman, p_plan, 'active', p_valid_until, 'admin', left(p_note, 300))
    on conflict (craftsman_id) do update
      set plan = excluded.plan, status = 'active', valid_until = excluded.valid_until,
          source = 'admin', note = excluded.note;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Contact requests: companies ("За фирми"), "Искам Pro", other.
-- Anyone can send one through the function; only admins can read or change them.
-- ---------------------------------------------------------------------------
create table public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('company', 'pro', 'other')),
  name text not null check (char_length(name) between 2 and 120),
  contact text not null check (char_length(contact) between 5 and 160),
  message text check (char_length(message) <= 2000),
  payload jsonb not null default '{}',
  user_id uuid references public.profiles (id) on delete set null,
  status text not null default 'new' check (status in ('new', 'talking', 'done', 'rejected')),
  admin_note text check (char_length(admin_note) <= 1000),
  ip_hash text,
  created_at timestamptz not null default now()
);
create index contact_requests_status_idx on public.contact_requests (status, created_at desc);

alter table public.contact_requests enable row level security;
create policy "admins read contact requests" on public.contact_requests
  for select to authenticated using (public.is_admin());
create policy "admins update contact requests" on public.contact_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.contact_requests from anon, authenticated;
grant select, update on public.contact_requests to authenticated;

create or replace function public.submit_contact_request(
  p_kind text,
  p_name text,
  p_contact text,
  p_message text default null,
  p_payload jsonb default '{}',
  p_trap text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ip text;
  v_hash text;
  v_id uuid;
begin
  -- hidden field that only bots fill in: pretend success, store nothing
  if coalesce(p_trap, '') <> '' then return gen_random_uuid(); end if;

  if p_kind not in ('company', 'pro', 'other') then raise exception 'Невалиден вид запитване.'; end if;
  if char_length(btrim(coalesce(p_name, ''))) < 2 then raise exception 'Напишете името си.'; end if;
  if char_length(btrim(coalesce(p_contact, ''))) < 5 then raise exception 'Напишете телефон или имейл за връзка.'; end if;
  if char_length(coalesce(p_message, '')) > 2000 then raise exception 'Съобщението е твърде дълго.'; end if;
  if jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object' or pg_column_size(p_payload) > 4000 then
    raise exception 'Невалидни данни.';
  end if;

  begin
    v_ip := coalesce(
      nullif(current_setting('request.headers', true)::jsonb ->> 'x-real-ip', ''),
      nullif(split_part(coalesce(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', ''), ',', 1), ''));
  exception when others then
    v_ip := null;
  end;
  v_hash := case when v_ip is null then null else encode(sha256(convert_to(v_ip, 'UTF8')), 'hex') end;

  if v_hash is not null and (
    select count(*) from public.contact_requests
    where ip_hash = v_hash and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Твърде много запитвания. Опитайте по-късно.';
  end if;
  if (select count(*) from public.contact_requests where created_at > now() - interval '10 minutes') >= 40 then
    raise exception 'Твърде много запитвания. Опитайте по-късно.';
  end if;

  insert into public.contact_requests (kind, name, contact, message, payload, user_id, ip_hash)
  values (p_kind, btrim(p_name), btrim(p_contact), nullif(btrim(coalesce(p_message, '')), ''),
          coalesce(p_payload, '{}'::jsonb), auth.uid(), v_hash)
  returning id into v_id;
  return v_id;
end;
$$;

-- Function grants (new functions are executable by PUBLIC unless revoked)
revoke execute on function
  public.craftsman_plan(uuid), public.plan_limit(uuid, text), public.has_feature(uuid, text),
  public.my_plan(), public.enforce_plan_limit(),
  public.admin_set_plan(uuid, text, timestamptz, text),
  public.submit_contact_request(text, text, text, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.craftsman_plan(uuid), public.plan_limit(uuid, text), public.has_feature(uuid, text)
  to anon, authenticated;
grant execute on function public.my_plan(), public.admin_set_plan(uuid, text, timestamptz, text) to authenticated;
grant execute on function public.submit_contact_request(text, text, text, text, jsonb, text) to anon, authenticated;
