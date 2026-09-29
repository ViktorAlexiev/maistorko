-- Майсторко: publish gate.
-- A craftsman appears in public listings (search, category counts, home) only
-- once the profile is usable: at least one category, a price or "по оглед",
-- and a weekly schedule. Incomplete sign-ups stay private until finished.

create or replace function public.craftsman_is_listed(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.craftsman_profiles c
    join public.profiles p on p.id = c.id
    where c.id = p_id
      and not c.is_hidden
      and not p.is_banned
      and char_length(btrim(c.display_name)) >= 2
      and (c.price_from is not null or c.quote_on_inspection)
      and exists (select 1 from public.craftsman_categories cc where cc.craftsman_id = c.id)
      and exists (select 1 from public.availability_rules ar where ar.craftsman_id = c.id)
  )
$$;

-- Listed craftsmen per top-level category
create or replace function public.category_counts()
returns table (slug text, craftsmen int)
language sql
stable
security definer
set search_path = ''
as $$
  select top.slug, count(distinct cc.craftsman_id)::int
  from public.craftsman_categories cc
  join public.categories cat on cat.id = cc.category_id
  join public.categories top on top.id = coalesce(cat.parent_id, cat.id)
  where public.craftsman_is_listed(cc.craftsman_id)
  group by top.slug
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
      and public.craftsman_is_listed(cp.id)
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

grant execute on function public.craftsman_is_listed(uuid), public.category_counts() to anon, authenticated;
