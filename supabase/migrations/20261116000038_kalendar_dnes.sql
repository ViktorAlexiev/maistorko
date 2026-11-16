-- Calendar: today's rule and a test clock.
-- 1) dev_clock + sofia_now(): "now" for the rules below; a row in dev_clock pins the time of day (checks only).
-- 2) day_free_ranges: today is trimmed to start at the next half hour, and is empty without short_notice
--    or with less than 2 hours left. Every other day is exactly as before (migration 12, jobs and multi-day).
-- 3) propose_booking: two new refusals (a past hour today; a client proposing today to a craftsman without
--    short_notice). The body is migration 33 (company conversations) unchanged otherwise.

-- ---------------------------------------------------------------------------
-- Test clock: at most one row, nobody but the database owner and the service role can touch it
-- ---------------------------------------------------------------------------
create table public.dev_clock (
  id boolean primary key default true check (id),
  time_of_day time not null
);
alter table public.dev_clock enable row level security;
revoke all on public.dev_clock from anon, authenticated;

create or replace function public.sofia_now()
returns timestamp
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select (now() at time zone 'Europe/Sofia')::date + c.time_of_day from public.dev_clock c),
    now() at time zone 'Europe/Sofia')
$$;

grant execute on function public.sofia_now() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- day_free_ranges: the old expression is CTE "base"; today is cut on top of it
-- ---------------------------------------------------------------------------
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
  ),
  base as (
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
            and p_day between b.booking_date and coalesce(b.end_date, b.booking_date)
          union all
          select tsrange(
            p_day + coalesce(j.start_time, time '00:00'),
            case when j.end_time is null then (p_day + 1)::timestamp else p_day + j.end_time end)
          from public.jobs j
          where j.craftsman_id = p_craftsman and j.status = 'planned'
            and p_day between j.start_date and j.end_date
        ) s
      ), '{}'::tsmultirange) as r
  ),
  clock as (
    select public.sofia_now() as t
  ),
  cut as (
    select
      base.r as full_r,
      (p_day = clock.t::date) as is_today,
      -- from the next half hour (exactly 13:30 stays 13:30) to the end of the day
      base.r * tsmultirange(tsrange(
        date_bin('30 minutes', clock.t - interval '1 microsecond', p_day::timestamp) + interval '30 minutes',
        (p_day + 1)::timestamp)) as cut_r
    from base, clock
  )
  select
    case
      when not cut.is_today then cut.full_r
      when not coalesce((select cp.short_notice from public.craftsman_profiles cp where cp.id = p_craftsman), false)
        then '{}'::tsmultirange
      when coalesce((select sum(upper(r) - lower(r)) from unnest(cut.cut_r) r), interval '0') < interval '120 minutes'
        then '{}'::tsmultirange
      else cut.cut_r
    end
  from cut
$$;

-- ---------------------------------------------------------------------------
-- propose_booking: migration 33 plus the two new refusals after the 180-day check
-- ---------------------------------------------------------------------------
create or replace function public.propose_booking(
  p_conversation uuid,
  p_date date,
  p_start time default null,
  p_end time default null,
  p_kind text default 'work',
  p_note text default null,
  p_end_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_conv public.conversations;
  v_b public.bookings;
  v_craftsman uuid;
  v_by_craftsman boolean;
  v_end date := case when p_end_date is not null and p_end_date > p_date then p_end_date end;
  v_short boolean;
  v_first text;
begin
  if v_me is null then raise exception 'Влезте в профила си.' using errcode = '42501'; end if;
  if public.is_banned() then raise exception 'Профилът ви е блокиран.' using errcode = '42501'; end if;
  select * into v_conv from public.conversations where id = p_conversation;
  v_craftsman := coalesce(v_conv.craftsman_id, v_conv.assigned_to);
  if v_conv.id is null or v_me not in (v_conv.client_id, coalesce(v_craftsman, v_conv.client_id)) then
    if v_conv.id is not null and v_conv.org_id is not null and v_craftsman is null and public.is_conv_party(v_conv.id) then
      raise exception 'Първо възложете разговора на майстор от фирмата.';
    end if;
    raise exception 'Разговорът не е намерен.' using errcode = '42501';
  end if;
  if p_date is null or p_date < (now() at time zone 'Europe/Sofia')::date then
    raise exception 'Изберете дата от днес нататък.';
  end if;
  if coalesce(v_end, p_date) > (now() at time zone 'Europe/Sofia')::date + 180 then
    raise exception 'Датата е твърде далеч.';
  end if;

  if p_date = public.sofia_now()::date then
    if p_start is not null and p_start < public.sofia_now()::time then
      raise exception 'Този час вече мина. Избери по-късен час или друг ден.';
    end if;
    if v_me = v_conv.client_id then
      select cp.short_notice, split_part(btrim(cp.display_name), ' ', 1)
        into v_short, v_first
        from public.craftsman_profiles cp
        where cp.id = v_craftsman;
      if v_short is not null and not v_short then
        raise exception '% не идва в същия ден. Избери дата от утре нататък.', v_first;
      end if;
    end if;
  end if;

  if (p_start is null) <> (p_end is null) or (p_start is not null and p_end <= p_start) then
    raise exception 'Краят трябва да е след началото.';
  end if;
  if v_end is not null and p_start is not null then
    raise exception 'Работа за няколко дни е за цели дни, без часове.';
  end if;
  if v_end is not null and v_end - p_date > 120 then raise exception 'Периодът е твърде дълъг.'; end if;
  if p_kind not in ('inspection', 'work') then raise exception 'Невалиден вид уговорка.'; end if;
  if p_kind = 'inspection' and v_end is not null then raise exception 'Огледът е за един ден.'; end if;

  v_by_craftsman := v_me = v_craftsman;

  insert into public.bookings (conversation_id, craftsman_id, client_id, booking_date, end_date, start_time, end_time,
                               kind, status, note, proposed_by, responded_by)
  values (v_conv.id, v_craftsman, v_conv.client_id, p_date, v_end, p_start, p_end, p_kind,
          'proposed',
          nullif(btrim(coalesce(p_note, '')), ''), v_me,
          null)
  returning * into v_b;

  if v_by_craftsman and public.booking_overlaps(v_b) then
    raise exception 'Вече имате потвърдена уговорка или поръчка в този период.';
  end if;

  insert into public.messages (conversation_id, sender_id, body, meta)
  values (v_conv.id, v_me,
          'Предлагам ' || public.booking_label(v_b),
          jsonb_build_object('booking_id', v_b.id, 'event', 'proposed'));
  return v_b.id;
end;
$$;
