-- 1. A craftsman can say how fast he usually answers ("до 2 часа"). Shown in his profile.
-- 2. The calendar is only a signal: an old calendar is punished more gently in "Препоръчани"
--    (full score up to 7 days since it was confirmed, falling to zero at 60 days instead of 30).

alter table public.craftsman_profiles
  add column reply_within_hours smallint check (reply_within_hours in (1, 2, 4, 24, 48));

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
    -- F: 1 up to 7 days since the calendar was confirmed, falling to 0 at 60 days (a gentle slope: the calendar is a hint)
    greatest(0, least(1, (60 - extract(epoch from now() - c.last_confirmed_at) / 86400.0) / 53.0)),
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

revoke execute on function public.rank_signals(uuid[]) from public, anon, authenticated;
