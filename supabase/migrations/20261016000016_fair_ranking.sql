-- Fair ranking ("Препоръчани"). Everyone is scored by the same public rules; nobody can buy a better score.
-- The method is described on the page "Как подреждаме" (/kak-podrejdame).
--
--   score = 0.35·A availability + 0.20·R rating (Bayesian) + 0.20·P responsiveness
--         + 0.15·F calendar freshness + 0.10·Q completeness + N newcomer bonus (+ 0.25·text match when searching)
--   exposure fairness: whoever was shown less than their share lately moves up a little, whoever was shown
--         more moves down a little (±0.10, bounded by tanh)
--   a seeded random tie-break (Gumbel noise, "temperature" 0.06) so close scores take turns; the seed is derived
--         from the visitor and the day by the app, so one visitor sees a stable order and different visitors see
--         different orders.
-- Years of experience and the "verified" badge are shown to clients but are not part of the score.

-- Weighted exposure: a place at position k is worth 1/log2(k+1)
alter table public.daily_stats add column exposure numeric(12,4) not null default 0 check (exposure >= 0);

drop function public.record_impressions(uuid[]);
create or replace function public.record_impressions(p_ids uuid[], p_offset integer default 0)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_pos integer;
  v_day date := (now() at time zone 'Europe/Sofia')::date;
begin
  if p_ids is null or cardinality(p_ids) > 60 then return; end if;
  -- a craftsman listed twice counts once, at his best (first) position
  for v_id, v_pos in
    select x.id, min(x.pos) from unnest(p_ids) with ordinality as x(id, pos) group by x.id
  loop
    if v_id is distinct from auth.uid() and exists (select 1 from public.craftsman_profiles where id = v_id and not is_hidden) then
      insert into public.daily_stats (craftsman_id, day, impressions, exposure)
      values (v_id, v_day, 1, round((ln(2.0) / ln((greatest(p_offset, 0) + v_pos + 1)::numeric))::numeric, 4))
      on conflict (craftsman_id, day) do update
        set impressions = public.daily_stats.impressions + 1,
            exposure = public.daily_stats.exposure + excluded.exposure;
    end if;
  end loop;
end;
$$;

-- Per-profile signals in [0,1] (N is a bonus up to 0.15, E is the 30-day exposure).
create or replace function public.rank_signals(p_ids uuid[])
returns table (craftsman_id uuid, r numeric, p numeric, f numeric, q numeric, n numeric, e numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with m as (
    select coalesce(avg(c.rating_avg) filter (where c.rating_count > 0), 4.5) as mean from public.craftsman_profiles c
  )
  select c.id,
    -- R: Bayesian average with prior weight 5, scaled 1..5 -> 0..1. One review of 5.0 does not beat forty of 4.8.
    ((5 * m.mean + c.rating_avg * c.rating_count) / (5 + c.rating_count) - 1) / 4,
    -- P: share of inquiries answered within 24 h over 90 days, with a prior of 4 answered out of 5
    (4 + coalesce(cv.replied24, 0))::numeric / (5 + coalesce(cv.inq, 0)),
    -- F: 1 up to 7 days since the calendar was confirmed, falling to 0 at 30 days
    greatest(0, least(1, (30 - extract(epoch from now() - c.last_confirmed_at) / 86400.0) / 23.0)),
    -- Q: photos (up to 6), services (up to 5) and a real description (120+ characters)
    (least(coalesce(ph.n, 0), 6) / 6.0) * 0.4 + (least(coalesce(sv.n, 0), 5) / 5.0) * 0.3
      + least(char_length(c.bio), 120) / 120.0 * 0.3,
    -- N: newcomers get a bonus that fades over their first 60 days, while they have fewer than 3 reviews
    case when c.created_at > now() - interval '60 days' and c.rating_count < 3
         then 0.15 * exp(-extract(epoch from now() - c.created_at) / 86400.0 / 20.0) else 0 end,
    coalesce(ex.e, 0)
  from public.craftsman_profiles c
  cross join m
  left join lateral (
    select count(*) as inq, count(*) filter (where v.craftsman_replied_at - v.created_at <= interval '24 hours') as replied24
    from public.conversations v where v.craftsman_id = c.id and v.created_at > now() - interval '90 days'
  ) cv on true
  left join lateral (select count(*) as n from public.work_photos w where w.craftsman_id = c.id) ph on true
  left join lateral (select count(*) as n from public.services s where s.craftsman_id = c.id) sv on true
  left join lateral (
    select sum(d.exposure) as e from public.daily_stats d
    where d.craftsman_id = c.id and d.day > (now() at time zone 'Europe/Sofia')::date - 30
  ) ex on true
  where c.id = any (p_ids)
$$;

-- ---------------------------------------------------------------------------
-- search_craftsmen with sort = 'recommended' and a seed
-- ---------------------------------------------------------------------------
drop function public.search_craftsmen(text, text, text, date, date, text, numeric, numeric, numeric, boolean, text, integer, integer, boolean, uuid[]);

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
             0.35 * (case when p_date_from is not null then 1.0
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
           end as skey
    from scored0 s0
  ),
  paged as (
    select c.* from scored c
    order by
      case when p_sort = 'recommended' then c.skey end desc nulls last,
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
    case when p_sort = 'recommended' then p.skey end desc nulls last,
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

revoke execute on function public.record_impressions(uuid[], integer), public.rank_signals(uuid[])
  from public, anon, authenticated;
grant execute on function public.record_impressions(uuid[], integer) to anon, authenticated;
-- rank_signals is internal (used by search_craftsmen, which is security definer)
grant execute on function public.search_craftsmen(text, text, text, date, date, text, numeric, numeric, numeric, boolean, text, integer, integer, boolean, uuid[], text)
  to anon, authenticated;
