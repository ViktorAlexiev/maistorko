-- The newer edit wins. If a craftsman edits a single day after marking a longer period
-- (for example "Зает тази седмица"), that day's own exceptions replace the period for that day.
-- Marking a period later puts the period back on top.

create or replace function public.day_free_ranges(p_craftsman uuid, p_day date)
returns tsmultirange
language sql
stable
security definer
set search_path = ''
as $$
  with ex as (
    select e.*, (e.start_date = e.end_date) as single
    from public.availability_exceptions e
    where e.craftsman_id = p_craftsman and p_day between e.start_date and e.end_date
  ),
  eff as (
    select * from ex
    where single
       or coalesce((select max(created_at) from ex where single), '-infinity')
          <= coalesce((select max(created_at) from ex where not single), '-infinity')
  )
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
        from eff e
        where e.kind = 'free'
      ) s
    ), '{}'::tsmultirange)
    -
    coalesce((
      select range_agg(r) from (
        select tsrange(
          p_day + coalesce(e.start_time, time '00:00'),
          case when e.end_time is null then (p_day + 1)::timestamp else p_day + e.end_time end) as r
        from eff e
        where e.kind = 'busy'
        union all
        select tsrange(
          p_day + coalesce(b.start_time, time '00:00'),
          case when b.end_time is null then (p_day + 1)::timestamp else p_day + b.end_time end)
        from public.bookings b
        where b.craftsman_id = p_craftsman and b.status = 'confirmed'
          and b.booking_date = p_day
      ) s
    ), '{}'::tsmultirange)
$$;
