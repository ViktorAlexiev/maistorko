-- Statistics for craftsmen: profile views, search impressions, phone reveals (daily counters, no visitor data),
-- plus inquiries, bookings and response speed computed from existing tables.
-- Free: totals for 30 days and response speed. Pro ('stats_detail'): weekly series.

create table public.daily_stats (
  craftsman_id uuid not null references public.craftsman_profiles (id) on delete cascade,
  day date not null default ((now() at time zone 'Europe/Sofia')::date),
  views integer not null default 0 check (views >= 0),
  impressions integer not null default 0 check (impressions >= 0),
  phone_reveals integer not null default 0 check (phone_reveals >= 0),
  primary key (craftsman_id, day)
);
alter table public.daily_stats enable row level security;
create policy "owner reads own stats" on public.daily_stats for select to authenticated
  using (public.can_manage_craftsman(craftsman_id));
revoke all on public.daily_stats from anon, authenticated;
grant select on public.daily_stats to authenticated;

create or replace function public.bump_stat(p_craftsman uuid, p_column text, p_by integer default 1)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'Europe/Sofia')::date;
begin
  if p_by is null or p_by < 1 then return; end if;
  if p_column = 'views' then
    insert into public.daily_stats (craftsman_id, day, views) values (p_craftsman, v_day, p_by)
    on conflict (craftsman_id, day) do update set views = public.daily_stats.views + p_by;
  elsif p_column = 'impressions' then
    insert into public.daily_stats (craftsman_id, day, impressions) values (p_craftsman, v_day, p_by)
    on conflict (craftsman_id, day) do update set impressions = public.daily_stats.impressions + p_by;
  elsif p_column = 'phone_reveals' then
    insert into public.daily_stats (craftsman_id, day, phone_reveals) values (p_craftsman, v_day, p_by)
    on conflict (craftsman_id, day) do update set phone_reveals = public.daily_stats.phone_reveals + p_by;
  end if;
end;
$$;

-- A profile page was opened (not by the craftsman himself)
create or replace function public.record_profile_view(p_slug text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  select c.id into v_id from public.craftsman_profiles c where c.slug = p_slug and not c.is_hidden;
  if v_id is null or v_id = auth.uid() then return; end if;
  perform public.bump_stat(v_id, 'views');
end;
$$;

-- Craftsmen shown in search results or on the home page
create or replace function public.record_impressions(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if p_ids is null or cardinality(p_ids) > 60 then return; end if;
  for v_id in select distinct unnest(p_ids) loop
    if v_id is distinct from auth.uid() and exists (select 1 from public.craftsman_profiles where id = v_id and not is_hidden) then
      perform public.bump_stat(v_id, 'impressions');
    end if;
  end loop;
end;
$$;

-- The phone for the current viewer (same rules as craftsman_phone), counting a reveal
create or replace function public.reveal_phone(p_craftsman uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_phone text;
begin
  v_phone := public.craftsman_phone(p_craftsman);
  if v_phone is not null and p_craftsman is distinct from auth.uid() then
    perform public.bump_stat(p_craftsman, 'phone_reveals');
  end if;
  return v_phone;
end;
$$;

-- ---------------------------------------------------------------------------
-- The signed-in craftsman's statistics
-- ---------------------------------------------------------------------------
create or replace function public.my_stats(p_weeks integer default 8)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_today date := (now() at time zone 'Europe/Sofia')::date;
  v_from date := v_today - 29;
  v_detail boolean;
  v_weeks integer := least(greatest(coalesce(p_weeks, 8), 1), 26);
  v_totals jsonb;
  v_series jsonb := '[]';
  v_response jsonb;
begin
  if v_me is null or not exists (select 1 from public.craftsman_profiles where id = v_me) then
    raise exception 'Нямате профил на майстор.' using errcode = '42501';
  end if;
  v_detail := public.has_feature(v_me, 'stats_detail');

  select jsonb_build_object(
    'views', coalesce((select sum(views) from public.daily_stats where craftsman_id = v_me and day >= v_from), 0),
    'impressions', coalesce((select sum(impressions) from public.daily_stats where craftsman_id = v_me and day >= v_from), 0),
    'phone_reveals', coalesce((select sum(phone_reveals) from public.daily_stats where craftsman_id = v_me and day >= v_from), 0),
    'link_visits', coalesce((select sum(visits) from public.link_visits where craftsman_id = v_me and day >= v_from), 0),
    'inquiries', (select count(*) from public.conversations where craftsman_id = v_me
                  and (created_at at time zone 'Europe/Sofia')::date >= v_from),
    'bookings', (select count(*) from public.bookings where craftsman_id = v_me and status = 'confirmed'
                 and (created_at at time zone 'Europe/Sofia')::date >= v_from)
  ) into v_totals;

  if v_detail then
    select coalesce(jsonb_agg(jsonb_build_object(
             'week_start', w.week_start,
             'views', coalesce(s.views, 0), 'impressions', coalesce(s.impressions, 0),
             'phone_reveals', coalesce(s.phone_reveals, 0), 'link_visits', coalesce(l.visits, 0),
             'inquiries', coalesce(q.n, 0), 'bookings', coalesce(b.n, 0)) order by w.week_start), '[]')
    into v_series
    from (select (date_trunc('week', v_today::timestamp) - make_interval(weeks => g))::date as week_start
          from generate_series(v_weeks - 1, 0, -1) g) w
    left join lateral (select sum(views) views, sum(impressions) impressions, sum(phone_reveals) phone_reveals
                       from public.daily_stats d where d.craftsman_id = v_me
                         and d.day >= w.week_start and d.day < w.week_start + 7) s on true
    left join lateral (select sum(visits) visits from public.link_visits lv where lv.craftsman_id = v_me
                         and lv.day >= w.week_start and lv.day < w.week_start + 7) l on true
    left join lateral (select count(*) n from public.conversations c where c.craftsman_id = v_me
                         and (c.created_at at time zone 'Europe/Sofia')::date >= w.week_start
                         and (c.created_at at time zone 'Europe/Sofia')::date < w.week_start + 7) q on true
    left join lateral (select count(*) n from public.bookings bk where bk.craftsman_id = v_me and bk.status = 'confirmed'
                         and (bk.created_at at time zone 'Europe/Sofia')::date >= w.week_start
                         and (bk.created_at at time zone 'Europe/Sofia')::date < w.week_start + 7) b on true;
  end if;

  select jsonb_build_object(
    'inquiries', count(*),
    'replied', count(craftsman_replied_at),
    'replied_24h', count(*) filter (where craftsman_replied_at - created_at <= interval '24 hours'),
    'median_minutes', (percentile_cont(0.5) within group (order by extract(epoch from craftsman_replied_at - created_at) / 60)
                       filter (where craftsman_replied_at is not null))
  ) into v_response
  from public.conversations
  where craftsman_id = v_me and created_at > now() - interval '90 days';

  return jsonb_build_object('detail', v_detail, 'totals', v_totals, 'weeks', v_series, 'response', v_response);
end;
$$;

revoke execute on function
  public.bump_stat(uuid, text, integer), public.record_profile_view(text), public.record_impressions(uuid[]),
  public.reveal_phone(uuid), public.my_stats(integer)
  from public, anon, authenticated;
grant execute on function public.record_profile_view(text), public.record_impressions(uuid[]), public.reveal_phone(uuid)
  to anon, authenticated;
grant execute on function public.my_stats(integer) to authenticated;
