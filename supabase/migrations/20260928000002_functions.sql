-- Майсторко: functions, triggers, availability engine, search RPC, chat RPCs

-- ---------------------------------------------------------------------------
-- Role helpers (security definer so policies can call them without recursion)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and not p.is_banned
  )
$$;

create or replace function public.is_banned()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_banned from public.profiles p where p.id = auth.uid()), false)
$$;

-- Direct API calls run as anon/authenticated; internal security-definer code
-- runs as the function owner. Protected columns are only guarded for the API.
create or replace function public.is_api_request()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user in ('anon', 'authenticated')
$$;

-- ---------------------------------------------------------------------------
-- Slugs
-- ---------------------------------------------------------------------------
create or replace function public.unique_craftsman_slug(base text, self_id uuid default null)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  root text := coalesce(nullif(public.slugify(base), ''), 'maistor');
  candidate text := root;
  n int := 1;
begin
  root := left(root, 60);
  candidate := root;
  while exists (
    select 1 from public.craftsman_profiles c
    where c.slug = candidate and (self_id is null or c.id <> self_id)
  ) loop
    n := n + 1;
    candidate := root || '-' || n;
  end loop;
  return candidate;
end;
$$;

-- ---------------------------------------------------------------------------
-- New auth user -> profile (+ craftsman profile)
-- Role can only be client or craftsman from sign-up metadata; never admin.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role := case
    when new.raw_user_meta_data ->> 'role' = 'craftsman' then 'craftsman'::public.user_role
    else 'client'::public.user_role end;
  v_name text := left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120);
  v_city smallint;
begin
  select c.id into v_city from public.cities c
  where c.slug = new.raw_user_meta_data ->> 'city';

  insert into public.profiles (id, role, full_name, city_id)
  values (new.id, v_role, v_name, v_city);

  if v_role = 'craftsman' then
    insert into public.craftsman_profiles (id, slug, display_name, city_id)
    values (
      new.id,
      public.unique_craftsman_slug(coalesce(nullif(v_name, ''), 'maistor')),
      coalesce(nullif(v_name, ''), 'Майстор'),
      v_city
    );
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- A client can turn their account into a craftsman account.
create or replace function public.become_craftsman()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_slug text;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null then raise exception 'Не сте влезли в профила си.'; end if;
  if v_profile.is_banned then raise exception 'Профилът е блокиран.'; end if;

  if v_profile.role = 'client' then
    update public.profiles set role = 'craftsman' where id = v_profile.id;
  end if;

  select slug into v_slug from public.craftsman_profiles where id = v_profile.id;
  if v_slug is null then
    v_slug := public.unique_craftsman_slug(coalesce(nullif(v_profile.full_name, ''), 'maistor'));
    insert into public.craftsman_profiles (id, slug, display_name, city_id, avatar_url)
    values (v_profile.id, v_slug, coalesce(nullif(v_profile.full_name, ''), 'Майстор'),
            v_profile.city_id, v_profile.avatar_url);
  end if;
  return v_slug;
end;
$$;

-- ---------------------------------------------------------------------------
-- Protected columns
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_api_request() and not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Ролята не може да се променя.' using errcode = '42501';
    end if;
    if new.is_banned is distinct from old.is_banned then
      raise exception 'Нямате права за тази промяна.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_columns();

create or replace function public.protect_craftsman_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_api_request() then
    if not public.is_admin() then
      if new.is_verified is distinct from old.is_verified
         or new.is_hidden is distinct from old.is_hidden
         or new.rating_avg is distinct from old.rating_avg
         or new.rating_count is distinct from old.rating_count then
        raise exception 'Нямате права за тази промяна.' using errcode = '42501';
      end if;
      if new.last_confirmed_at > now() + interval '1 minute' then
        new.last_confirmed_at := now();
      end if;
    end if;
    -- derived columns are never written through the API
    new.price_from := old.price_from;
    new.price_from_unit := old.price_from_unit;
    new.search_text := old.search_text;
    new.search_vector := old.search_vector;
    new.slug := case when new.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' then new.slug else old.slug end;
  end if;
  return new;
end;
$$;
create trigger craftsman_protect before update on public.craftsman_profiles
  for each row execute function public.protect_craftsman_columns();

-- Keep the public avatar on the craftsman card in sync with the account avatar.
create or replace function public.sync_craftsman_avatar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.craftsman_profiles set avatar_url = new.avatar_url
  where id = new.id and avatar_url is distinct from new.avatar_url;
  return new;
end;
$$;
create trigger profiles_avatar_sync after update of avatar_url on public.profiles
  for each row execute function public.sync_craftsman_avatar();

-- ---------------------------------------------------------------------------
-- Derived: search text/vector
-- ---------------------------------------------------------------------------
create or replace function public.refresh_craftsman_search(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_head text;
  v_cats text;
  v_services text;
  v_bio text;
begin
  select lower(concat_ws(' ', c.display_name, c.business_name, ci.name)), lower(c.bio)
    into v_head, v_bio
  from public.craftsman_profiles c
  left join public.cities ci on ci.id = c.city_id
  where c.id = p_id;

  if v_head is null then return; end if;

  select lower(string_agg(concat_ws(' ', cat.name, parent.name, array_to_string(cat.keywords, ' '),
                                    array_to_string(parent.keywords, ' ')), ' '))
    into v_cats
  from public.craftsman_categories cc
  join public.categories cat on cat.id = cc.category_id
  left join public.categories parent on parent.id = cat.parent_id
  where cc.craftsman_id = p_id;

  select lower(string_agg(concat_ws(' ', s.name, s.description), ' '))
    into v_services
  from public.services s where s.craftsman_id = p_id;

  update public.craftsman_profiles set
    search_text = left(concat_ws(' ', v_head, v_cats, v_services, v_bio), 6000),
    search_vector =
      setweight(to_tsvector('simple', coalesce(v_head, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(v_cats, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(v_services, '')), 'B') ||
      setweight(to_tsvector('simple', coalesce(v_bio, '')), 'C')
  where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Derived: headline price ("от X €/ч" or cheapest listed service)
-- ---------------------------------------------------------------------------
create or replace function public.refresh_craftsman_price(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rate numeric;
  v_price numeric;
  v_unit public.price_unit;
begin
  select hourly_rate into v_rate from public.craftsman_profiles where id = p_id;
  if v_rate is not null then
    v_price := v_rate;
    v_unit := 'hour';
  else
    select s.price, s.unit into v_price, v_unit
    from public.services s
    where s.craftsman_id = p_id and s.price_kind <> 'quote' and s.price is not null
    order by (s.unit = 'job') desc, s.price asc
    limit 1;
  end if;
  update public.craftsman_profiles
    set price_from = v_price, price_from_unit = v_unit
  where id = p_id;
end;
$$;

create or replace function public.trg_craftsman_derived()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_craftsman_search(new.id);
  perform public.refresh_craftsman_price(new.id);
  return null;
end;
$$;
create trigger craftsman_derived_ins after insert on public.craftsman_profiles
  for each row execute function public.trg_craftsman_derived();
create trigger craftsman_derived_upd
  after update of display_name, business_name, bio, city_id, hourly_rate on public.craftsman_profiles
  for each row execute function public.trg_craftsman_derived();

create or replace function public.trg_child_refresh()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := coalesce(new.craftsman_id, old.craftsman_id);
begin
  if tg_op = 'UPDATE' and old.craftsman_id <> new.craftsman_id then
    perform public.refresh_craftsman_search(old.craftsman_id);
    perform public.refresh_craftsman_price(old.craftsman_id);
  end if;
  perform public.refresh_craftsman_search(v_id);
  if tg_table_name = 'services' then
    perform public.refresh_craftsman_price(v_id);
  end if;
  return null;
end;
$$;
create trigger services_refresh after insert or update or delete on public.services
  for each row execute function public.trg_child_refresh();
create trigger craftsman_categories_refresh after insert or update or delete on public.craftsman_categories
  for each row execute function public.trg_child_refresh();

create or replace function public.trg_category_refresh()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare r record;
begin
  for r in
    select distinct cc.craftsman_id from public.craftsman_categories cc
    join public.categories c on c.id = cc.category_id
    where c.id = new.id or c.parent_id = new.id
  loop
    perform public.refresh_craftsman_search(r.craftsman_id);
  end loop;
  return null;
end;
$$;
create trigger categories_refresh after update of name, keywords on public.categories
  for each row execute function public.trg_category_refresh();

-- ---------------------------------------------------------------------------
-- Rating aggregates
-- ---------------------------------------------------------------------------
create or replace function public.refresh_craftsman_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := coalesce(new.craftsman_id, old.craftsman_id);
begin
  update public.craftsman_profiles c set
    rating_avg = coalesce((select round(avg(r.rating)::numeric, 2) from public.reviews r
                           where r.craftsman_id = v_id and not r.is_hidden), 0),
    rating_count = (select count(*) from public.reviews r
                    where r.craftsman_id = v_id and not r.is_hidden)
  where c.id = v_id;
  return null;
end;
$$;
create trigger reviews_aggregate after insert or update or delete on public.reviews
  for each row execute function public.refresh_craftsman_rating();

-- ---------------------------------------------------------------------------
-- Availability engine
-- free = (weekly blocks ∪ "free" exceptions) − "busy" exceptions
-- A full-day "free" exception means 08:00–20:00; a full-day "busy" means all day.
-- ---------------------------------------------------------------------------
create or replace function public.day_free_ranges(p_craftsman uuid, p_day date)
returns tsmultirange
language sql
stable
set search_path = ''
as $$
  select
    coalesce((
      select range_agg(r) from (
        select tsrange(p_day + ar.start_time, p_day + ar.end_time) as r
        from public.availability_rules ar
        where ar.craftsman_id = p_craftsman
          and ar.weekday = extract(isodow from p_day)
        union all
        select tsrange(p_day + coalesce(e.start_time, time '08:00'),
                       p_day + coalesce(e.end_time, time '20:00'))
        from public.availability_exceptions e
        where e.craftsman_id = p_craftsman and e.kind = 'free'
          and p_day between e.start_date and e.end_date
      ) s
    ), '{}'::tsmultirange)
    -
    coalesce((
      select range_agg(tsrange(
        p_day + coalesce(e.start_time, time '00:00'),
        case when e.end_time is null then (p_day + 1)::timestamp else p_day + e.end_time end))
      from public.availability_exceptions e
      where e.craftsman_id = p_craftsman and e.kind = 'busy'
        and p_day between e.start_date and e.end_date
    ), '{}'::tsmultirange)
$$;

create or replace function public.free_hours(ranges tsmultirange)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select coalesce(sum(extract(epoch from upper(r) - lower(r)) / 3600.0), 0)
  from unnest(ranges) r
$$;

-- 'free' (4h+ free), 'partial' (some free time), 'busy' (none)
create or replace function public.day_status(ranges tsmultirange)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when public.free_hours(ranges) >= 4 then 'free'
    when public.free_hours(ranges) > 0 then 'partial'
    else 'busy' end
$$;

create or replace function public.time_window(p_day date, p_slot text)
returns tsrange
language sql
immutable
set search_path = ''
as $$
  select case p_slot
    when 'morning' then tsrange(p_day + time '06:00', p_day + time '12:00')
    when 'afternoon' then tsrange(p_day + time '12:00', p_day + time '17:00')
    when 'evening' then tsrange(p_day + time '17:00', p_day + time '22:00')
    else tsrange(p_day::timestamp, (p_day + 1)::timestamp) end
$$;

-- Calendar freshness: 'fresh' < 14 days, 'stale' < 45 days, else 'expired'
create or replace function public.calendar_freshness(p_confirmed timestamptz)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_confirmed >= now() - interval '14 days' then 'fresh'
    when p_confirmed >= now() - interval '45 days' then 'stale'
    else 'expired' end
$$;

create or replace function public.availability_days(p_craftsman uuid, p_from date, p_days int)
returns table (day date, status text, free_hours numeric, ranges jsonb)
language sql
stable
set search_path = ''
as $$
  select d::date,
         public.day_status(fr),
         round(public.free_hours(fr), 1),
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'start', to_char(lower(r), 'HH24:MI'),
             'end', case when upper(r)::date > d::date then '24:00' else to_char(upper(r), 'HH24:MI') end)
             order by lower(r))
           from unnest(fr) r), '[]'::jsonb)
  from generate_series(p_from, p_from + (least(greatest(p_days, 1), 120) - 1), interval '1 day') d
  cross join lateral (select public.day_free_ranges(p_craftsman, d::date) as fr) x
$$;

-- 14-char strip: F/P/B per day starting at p_from
create or replace function public.availability_strip(p_craftsman uuid, p_from date, p_days int default 14)
returns text
language sql
stable
set search_path = ''
as $$
  select string_agg(case status when 'free' then 'F' when 'partial' then 'P' else 'B' end, '' order by day)
  from public.availability_days(p_craftsman, p_from, p_days)
$$;

create or replace function public.next_free_date(p_craftsman uuid, p_from date, p_horizon int default 45, p_slot text default null)
returns date
language plpgsql
stable
set search_path = ''
as $$
declare
  d date;
begin
  for i in 0 .. p_horizon - 1 loop
    d := p_from + i;
    if public.day_free_ranges(p_craftsman, d) && public.time_window(d, p_slot) then
      return d;
    end if;
  end loop;
  return null;
end;
$$;

-- Editing the calendar counts as confirming it.
create or replace function public.touch_calendar_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.craftsman_profiles set last_confirmed_at = now()
  where id = coalesce(new.craftsman_id, old.craftsman_id);
  return null;
end;
$$;
create trigger availability_rules_touch after insert or update or delete on public.availability_rules
  for each row execute function public.touch_calendar_confirmation();
create trigger availability_exceptions_touch after insert or update or delete on public.availability_exceptions
  for each row execute function public.touch_calendar_confirmation();

create or replace function public.confirm_calendar()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare v_now timestamptz := now();
begin
  update public.craftsman_profiles set last_confirmed_at = v_now where id = auth.uid();
  if not found then raise exception 'Нямате профил на майстор.'; end if;
  return v_now;
end;
$$;

-- ---------------------------------------------------------------------------
-- Search
-- ---------------------------------------------------------------------------
-- Light Bulgarian stemming: trims common inflection endings so prefixes match
-- ("боядисване" -> "боядис:*" matches "боядисвам", "боядисвач").
create or replace function public.search_stem(token text)
returns text
language sql
immutable
set search_path = ''
as $$
  with a as (
    -- drop the definite article (-та, -то, -те, -ът, -ят) first
    select case
      when char_length(token) >= 6 and right(token, 2) in ('та', 'то', 'те', 'ът', 'ят')
        then left(token, char_length(token) - 2)
      else token end as t
  )
  select case
    when char_length(t) >= 8 then left(t, char_length(t) - 2)
    when char_length(t) >= 5 then left(t, char_length(t) - 1)
    else t end
  from a
$$;

create or replace function public.build_search_query(p_q text, p_any boolean default false)
returns tsquery
language plpgsql
stable
set search_path = ''
as $$
declare
  tokens text[];
  parts text[] := '{}';
  t text;
  syn text;
  alts text[];
begin
  if p_q is null or btrim(p_q) = '' then return null; end if;
  tokens := regexp_split_to_array(lower(regexp_replace(p_q, '[^[:alnum:]]+', ' ', 'g')), '\s+');
  foreach t in array tokens loop
    continue when t is null or char_length(t) < 2;
    alts := array[public.search_stem(t) || ':*'];
    for syn in
      select regexp_split_to_table(s.expands_to, '\s+')
      from public.search_synonyms s
      where s.term = t or (char_length(t) >= 4 and s.term like t || '%')
    loop
      alts := alts || (public.search_stem(syn) || ':*');
    end loop;
    parts := parts || ('(' || array_to_string(alts, ' | ') || ')');
  end loop;
  if array_length(parts, 1) is null then return null; end if;
  return to_tsquery('simple', array_to_string(parts, case when p_any then ' | ' else ' & ' end));
exception when others then
  return null;
end;
$$;

create or replace function public.search_craftsmen(
  p_q text default null,
  p_category text default null,
  p_city text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_time text default null,
  p_price_min numeric default null,
  p_price_max numeric default null,
  p_min_rating numeric default null,
  p_verified boolean default false,
  p_sort text default 'soonest',
  p_limit int default 12,
  p_offset int default 0,
  p_any boolean default false,
  p_ids uuid[] default null
)
returns table (
  id uuid,
  slug text,
  display_name text,
  business_name text,
  avatar_url text,
  city_name text,
  city_slug text,
  category_names text[],
  price_from numeric,
  price_from_unit public.price_unit,
  quote_on_inspection boolean,
  rating_avg numeric,
  rating_count int,
  is_verified boolean,
  short_notice boolean,
  years_experience smallint,
  next_free date,
  matched_date date,
  strip text,
  freshness text,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_today date := (now() at time zone 'Europe/Sofia')::date;
  v_q tsquery := public.build_search_query(p_q, p_any);
  v_qtext text := lower(btrim(coalesce(p_q, '')));
  v_from date := greatest(coalesce(p_date_from, v_today), v_today);
  v_to date;
  v_city smallint;
  v_limit int := least(greatest(coalesce(p_limit, 12), 1), 48);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
begin
  if p_date_from is not null then
    v_to := least(greatest(coalesce(p_date_to, v_from), v_from), v_from + 30);
  end if;
  if p_city is not null and p_city <> '' then
    select c.id into v_city from public.cities c where c.slug = p_city;
    if v_city is null then return; end if;
  end if;

  return query
  with cat as (
    select c.id from public.categories c
    where p_category is not null and p_category <> ''
      and c.is_active
      and (c.slug = p_category
           or c.parent_id = (select p.id from public.categories p where p.slug = p_category))
  ),
  base as (
    select cp.*,
           case when v_q is not null then ts_rank(cp.search_vector, v_q) else 0 end
             + case when v_qtext <> '' then extensions.word_similarity(v_qtext, cp.search_text) else 0 end as relevance
    from public.craftsman_profiles cp
    join public.profiles pr on pr.id = cp.id
    where not cp.is_hidden
      and not pr.is_banned
      and exists (select 1 from public.craftsman_categories cc where cc.craftsman_id = cp.id)
      and (p_category is null or p_category = ''
           or exists (select 1 from public.craftsman_categories cc
                      where cc.craftsman_id = cp.id and cc.category_id in (select cat.id from cat)))
      and (v_city is null or cp.city_id = v_city
           or exists (select 1 from public.craftsman_service_areas sa
                      where sa.craftsman_id = cp.id and sa.city_id = v_city))
      and (v_qtext = ''
           or (v_q is not null and cp.search_vector @@ v_q)
           or extensions.strict_word_similarity(v_qtext, cp.search_text) >= 0.4)
      and (p_price_max is null or (cp.price_from is not null and cp.price_from <= p_price_max))
      and (p_price_min is null or (cp.price_from is not null and cp.price_from >= p_price_min))
      and (p_min_rating is null or (cp.rating_count > 0 and cp.rating_avg >= p_min_rating))
      and (not coalesce(p_verified, false) or cp.is_verified)
      and (p_ids is null or cp.id = any(p_ids))
  ),
  avail as (
    select b.*,
           public.calendar_freshness(b.last_confirmed_at) as fresh,
           case when p_date_from is not null then (
             select min(d::date) from generate_series(v_from, v_to, interval '1 day') d
             where public.day_free_ranges(b.id, d::date) && public.time_window(d::date, p_time)
           ) end as m_date,
           public.next_free_date(b.id, v_today, 45, p_time) as n_free
    from base b
  ),
  filtered as (
    select a.* from avail a
    where p_date_from is null or (a.m_date is not null and a.fresh <> 'expired')
  ),
  counted as (
    select f.*, count(*) over () as total from filtered f
  ),
  paged as (
    select c.* from counted c
    order by
      case when p_sort in ('soonest', 'relevance') then (c.fresh = 'fresh') end desc nulls last,
      case when p_sort = 'relevance' then c.relevance end desc nulls last,
      case when p_sort = 'soonest' then coalesce(c.m_date, c.n_free) end asc nulls last,
      case when p_sort = 'price' then c.price_from end asc nulls last,
      case when p_sort = 'rating' then c.rating_avg end desc nulls last,
      case when p_sort = 'rating' then c.rating_count end desc nulls last,
      case when p_sort = 'newest' then c.created_at end desc nulls last,
      c.is_verified desc,
      c.rating_avg desc,
      c.id
    limit v_limit offset v_offset
  )
  select p.id, p.slug, p.display_name, p.business_name, p.avatar_url,
         ci.name, ci.slug,
         (select array_agg(x.name order by x.sort, x.name) from (
            select distinct coalesce(par.name, cat.name) as name, coalesce(par.sort, cat.sort) as sort
            from public.craftsman_categories cc
            join public.categories cat on cat.id = cc.category_id
            left join public.categories par on par.id = cat.parent_id
            where cc.craftsman_id = p.id) x),
         p.price_from, p.price_from_unit, p.quote_on_inspection,
         p.rating_avg, p.rating_count, p.is_verified, p.short_notice, p.years_experience,
         p.n_free, p.m_date,
         case when p.fresh = 'expired' then null else public.availability_strip(p.id, v_today, 14) end,
         p.fresh, p.created_at, p.total
  from paged p
  left join public.cities ci on ci.id = p.city_id
  order by
    case when p_sort in ('soonest', 'relevance') then (p.fresh = 'fresh') end desc nulls last,
    case when p_sort = 'relevance' then p.relevance end desc nulls last,
    case when p_sort = 'soonest' then coalesce(p.m_date, p.n_free) end asc nulls last,
    case when p_sort = 'price' then p.price_from end asc nulls last,
    case when p_sort = 'rating' then p.rating_avg end desc nulls last,
    case when p_sort = 'rating' then p.rating_count end desc nulls last,
    case when p_sort = 'newest' then p.created_at end desc nulls last,
    p.is_verified desc,
    p.rating_avg desc,
    p.id;
end;
$$;

-- Price guidance for a category, computed from existing data
create or replace function public.category_price_guide(p_category smallint)
returns table (
  hourly_p25 numeric, hourly_median numeric, hourly_p75 numeric, hourly_count int,
  job_p25 numeric, job_median numeric, job_p75 numeric, job_count int
)
language sql
stable
security definer
set search_path = ''
as $$
  with cats as (
    select id from public.categories where id = p_category or parent_id = p_category
  ),
  crafts as (
    select distinct cc.craftsman_id from public.craftsman_categories cc
    join public.craftsman_profiles cp on cp.id = cc.craftsman_id and not cp.is_hidden
    where cc.category_id in (select id from cats)
  ),
  hourly as (
    select cp.hourly_rate v from public.craftsman_profiles cp
    where cp.id in (select craftsman_id from crafts) and cp.hourly_rate is not null
  ),
  jobs as (
    select s.price v from public.services s
    where s.craftsman_id in (select craftsman_id from crafts)
      and s.unit = 'job' and s.price is not null
      and (s.category_id is null or s.category_id in (select id from cats))
  )
  select
    round((select percentile_cont(0.25) within group (order by v) from hourly)::numeric, 0),
    round((select percentile_cont(0.5) within group (order by v) from hourly)::numeric, 0),
    round((select percentile_cont(0.75) within group (order by v) from hourly)::numeric, 0),
    (select count(*)::int from hourly),
    round((select percentile_cont(0.25) within group (order by v) from jobs)::numeric, 0),
    round((select percentile_cont(0.5) within group (order by v) from jobs)::numeric, 0),
    round((select percentile_cont(0.75) within group (order by v) from jobs)::numeric, 0),
    (select count(*)::int from jobs)
$$;

-- ---------------------------------------------------------------------------
-- Messaging RPCs
-- ---------------------------------------------------------------------------
create or replace function public.start_conversation(
  p_craftsman uuid,
  p_body text,
  p_date date default null,
  p_category smallint default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_conv uuid;
  v_meta jsonb := '{}';
begin
  if v_me is null then raise exception 'Влезте в профила си, за да пишете.' using errcode = '42501'; end if;
  if public.is_banned() then raise exception 'Профилът ви е блокиран.' using errcode = '42501'; end if;
  if v_me = p_craftsman then raise exception 'Не можете да пишете на себе си.'; end if;
  if p_body is null or char_length(btrim(p_body)) < 1 then raise exception 'Съобщението е празно.'; end if;
  if char_length(p_body) > 4000 then raise exception 'Съобщението е твърде дълго.'; end if;
  if p_date is not null and p_date < (now() at time zone 'Europe/Sofia')::date then
    raise exception 'Датата е в миналото.';
  end if;
  if not exists (
    select 1 from public.craftsman_profiles c join public.profiles p on p.id = c.id
    where c.id = p_craftsman and not c.is_hidden and not p.is_banned
  ) then
    raise exception 'Майсторът не е намерен.';
  end if;

  insert into public.conversations (client_id, craftsman_id, requested_date, category_id)
  values (v_me, p_craftsman, p_date, p_category)
  on conflict (client_id, craftsman_id) do update
    set requested_date = coalesce(excluded.requested_date, public.conversations.requested_date),
        category_id = coalesce(excluded.category_id, public.conversations.category_id)
  returning id into v_conv;

  if p_date is not null then v_meta := v_meta || jsonb_build_object('date', p_date); end if;
  if p_category is not null then
    v_meta := v_meta || jsonb_build_object('category',
      (select name from public.categories where id = p_category));
  end if;

  insert into public.messages (conversation_id, sender_id, body, meta)
  values (v_conv, v_me, btrim(p_body), v_meta);
  return v_conv;
end;
$$;

-- Keep conversation summary in sync; sender has read their own message.
create or replace function public.on_message_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations c set
    last_message_at = new.created_at,
    last_message_preview = left(regexp_replace(new.body, '\s+', ' ', 'g'), 140),
    last_sender_id = new.sender_id,
    client_last_read_at = case when new.sender_id = c.client_id then new.created_at else c.client_last_read_at end,
    craftsman_last_read_at = case when new.sender_id = c.craftsman_id then new.created_at else c.craftsman_last_read_at end
  where c.id = new.conversation_id;
  return null;
end;
$$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.on_message_insert();

create or replace function public.mark_conversation_read(p_conversation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations c set
    client_last_read_at = case when c.client_id = auth.uid() then now() else c.client_last_read_at end,
    craftsman_last_read_at = case when c.craftsman_id = auth.uid() then now() else c.craftsman_last_read_at end
  where c.id = p_conversation and auth.uid() in (c.client_id, c.craftsman_id);
end;
$$;

create or replace function public.my_conversations()
returns table (
  id uuid,
  i_am text,
  partner_id uuid,
  partner_name text,
  partner_avatar text,
  partner_slug text,
  requested_date date,
  category_name text,
  last_message_at timestamptz,
  last_message_preview text,
  last_from_me boolean,
  unread_count int
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id,
         case when c.client_id = auth.uid() then 'client' else 'craftsman' end,
         case when c.client_id = auth.uid() then c.craftsman_id else c.client_id end,
         case when c.client_id = auth.uid() then cp.display_name
              else coalesce(nullif(pc.full_name, ''), 'Клиент') end,
         case when c.client_id = auth.uid() then cp.avatar_url else pc.avatar_url end,
         case when c.client_id = auth.uid() then cp.slug else null end,
         c.requested_date,
         cat.name,
         c.last_message_at,
         c.last_message_preview,
         c.last_sender_id = auth.uid(),
         (select count(*)::int from public.messages m
          where m.conversation_id = c.id and m.sender_id <> auth.uid()
            and m.created_at > case when c.client_id = auth.uid()
                                    then c.client_last_read_at else c.craftsman_last_read_at end)
  from public.conversations c
  join public.craftsman_profiles cp on cp.id = c.craftsman_id
  join public.profiles pc on pc.id = c.client_id
  left join public.categories cat on cat.id = c.category_id
  where auth.uid() in (c.client_id, c.craftsman_id)
  order by c.last_message_at desc
$$;

create or replace function public.unread_total()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(x.unread_count), 0)::int from public.my_conversations() x
$$;

-- The craftsman's phone, shown to a client only if the craftsman opted in
-- (phone_after_chat) and has already replied in this conversation.
create or replace function public.conversation_partner_phone(p_conversation uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.phone
  from public.conversations c
  join public.craftsman_profiles cp on cp.id = c.craftsman_id
  join public.profiles p on p.id = c.craftsman_id
  where c.id = p_conversation
    and c.client_id = auth.uid()
    and cp.phone_after_chat
    and exists (select 1 from public.messages m where m.conversation_id = c.id and m.sender_id = c.craftsman_id)
$$;

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------
-- Eligible: the client has a conversation with the craftsman in which the
-- craftsman has replied at least once.
create or replace function public.can_review(p_craftsman uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and auth.uid() <> p_craftsman
     and not public.is_banned()
     and exists (
       select 1 from public.conversations c
       where c.client_id = auth.uid() and c.craftsman_id = p_craftsman
         and exists (select 1 from public.messages m
                     where m.conversation_id = c.id and m.sender_id = p_craftsman)
     )
$$;

create or replace function public.craftsman_reviews(p_craftsman uuid, p_limit int default 20)
returns table (id uuid, rating smallint, body text, created_at timestamptz, author text, is_mine boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.rating, r.body, r.created_at,
         coalesce(nullif(split_part(btrim(p.full_name), ' ', 1), ''), 'Клиент')
           || case when split_part(btrim(p.full_name), ' ', 2) <> ''
                   then ' ' || left(split_part(btrim(p.full_name), ' ', 2), 1) || '.' else '' end,
         r.client_id = auth.uid()
  from public.reviews r
  join public.profiles p on p.id = r.client_id
  where r.craftsman_id = p_craftsman and not r.is_hidden
  order by r.created_at desc
  limit least(greatest(p_limit, 1), 100)
$$;

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_users(
  p_q text default null,
  p_role public.user_role default null,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  id uuid, email text, full_name text, role public.user_role, is_banned boolean,
  created_at timestamptz, craftsman_slug text, is_verified boolean, is_hidden boolean,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Нямате администраторски права.' using errcode = '42501';
  end if;
  return query
  select p.id, u.email::text, p.full_name, p.role, p.is_banned, p.created_at,
         c.slug, c.is_verified, c.is_hidden, count(*) over ()
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.craftsman_profiles c on c.id = p.id
  where (p_role is null or p.role = p_role)
    and (p_q is null or p_q = '' or p.full_name ilike '%' || p_q || '%'
         or u.email ilike '%' || p_q || '%' or c.display_name ilike '%' || p_q || '%')
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: RPCs callable from the API. Internal helpers stay private.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.is_admin(), public.is_banned(), public.is_api_request(),
  public.slugify(text), public.bg_translit(text),
  public.search_craftsmen(text, text, text, date, date, text, numeric, numeric, numeric, boolean, text, int, int, boolean, uuid[]),
  public.availability_days(uuid, date, int),
  public.availability_strip(uuid, date, int),
  public.next_free_date(uuid, date, int, text),
  public.calendar_freshness(timestamptz),
  public.category_price_guide(smallint),
  public.craftsman_reviews(uuid, int),
  public.day_free_ranges(uuid, date),
  public.free_hours(tsmultirange), public.day_status(tsmultirange),
  public.time_window(date, text), public.build_search_query(text, boolean), public.search_stem(text)
to anon, authenticated;

grant execute on function
  public.become_craftsman(),
  public.confirm_calendar(),
  public.start_conversation(uuid, text, date, smallint),
  public.mark_conversation_read(uuid),
  public.conversation_partner_phone(uuid),
  public.my_conversations(),
  public.unread_total(),
  public.can_review(uuid),
  public.admin_list_users(text, public.user_role, int, int)
to authenticated;
