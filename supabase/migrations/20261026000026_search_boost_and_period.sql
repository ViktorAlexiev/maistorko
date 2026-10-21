-- Period search shows how many of the days are free ("свободен 9 от 10 дни") and fuller availability ranks higher.
-- Pro gets a small paid boost in the "recommended" order and is marked as a partner. The paid places are capped:
-- at most 3 of every 10 places go to boosted profiles (the n-th boosted profile cannot come before place 1 + ceil((n-1)*10/3)).
-- Everything else is unchanged.

drop function public.search_craftsmen(text, text, text, date, date, text, numeric, numeric, numeric, boolean, text, integer, integer, boolean, uuid[], text);

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
  p_ids uuid[] default null,
  p_seed text default null
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
  total_count bigint,
  is_pro boolean,
  free_days int,
  span_days int
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
  v_temp constant numeric := 0.06;
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
           case when p_date_from is not null then (
             select count(*)::int from generate_series(v_from, v_to, interval '1 day') d
             where public.day_free_ranges(b.id, d::date) && public.time_window(d::date, p_time)
           ) end as m_free,
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
  sig as (
    select * from public.rank_signals(
      case when p_sort = 'recommended' then (select array_agg(c.id) from counted c) else '{}'::uuid[] end)
  ),
  scored0 as (
    select c.*,
           case when p_sort = 'recommended' then
             0.35 * (case when p_date_from is not null then c.m_free::numeric / greatest(v_to - v_from + 1, 1)
                          else exp(-greatest(coalesce(c.n_free - v_today, 45), 0) / 3.0) end)
             + 0.20 * sg.r + 0.20 * sg.p + 0.15 * sg.f + 0.10 * sg.q + sg.n
             + case when v_qtext <> '' then 0.25 * least(c.relevance::numeric, 1.0) else 0 end
           end as s,
           coalesce(sg.e, 0) as e
    from counted c
    left join sig sg on sg.craftsman_id = c.id
  ),
  scored as (
    select s0.*,
           case when p_sort = 'recommended' then
             s0.s
             -- paid boost (Pro): a small, fixed lift; Pro profiles are marked "Препоръчан партньор" in the list
             + case when public.has_feature(s0.id, 'boost') then 0.08 else 0 end
             -- exposure fairness: share of the shown places this profile "deserves" by score vs. what it got
             + 0.10 * tanh((
                 case when sum(s0.e) over () > 0 and sum(s0.s) over () > 0 then
                   greatest(-1, least(1,
                     ((s0.s / sum(s0.s) over () * sum(s0.e) over ()) - s0.e)
                     / greatest(s0.s / sum(s0.s) over () * sum(s0.e) over (), 0.0001)))
                 else 0 end)::double precision)::numeric
             -- seeded Gumbel noise: the same visitor and day give the same order
             + case when p_seed is null then 0
                    else v_temp * (-ln(-ln((abs(mod(hashtextextended(s0.id::text || p_seed, 0), 1000000)) + 0.5) / 1000001.0)))
               end
           end as skey,
           public.has_feature(s0.id, 'boost') as is_boost
    from scored0 s0
  ),
  -- natural place by score, and the place among the boosted profiles
  ranked as (
    select s.*,
           row_number() over (order by s.skey desc nulls last, s.id) as nat,
           row_number() over (partition by s.is_boost order by s.skey desc nulls last, s.id) as boost_n
    from scored s
  ),
  -- the cap: a boosted profile waits until its turn (3 of every 10 places)
  keyed as (
    select r.*,
           case when r.is_boost then greatest(r.nat, ceil((r.boost_n - 1) * 10 / 3.0)::int + 1) else r.nat end as okey
    from ranked r
  ),
  paged as (
    select c.* from keyed c
    order by
      case when p_sort = 'recommended' then c.okey end asc nulls last,
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
         p.fresh, p.created_at, p.total,
         public.has_feature(p.id, 'boost'), p.m_free,
         case when p_date_from is not null then (v_to - v_from + 1)::int end
  from paged p
  left join public.cities ci on ci.id = p.city_id
  order by
    case when p_sort = 'recommended' then p.okey end asc nulls last,
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

grant execute on function public.search_craftsmen(text, text, text, date, date, text, numeric, numeric, numeric, boolean, text, integer, integer, boolean, uuid[], text)
  to anon, authenticated;
