-- "Мои поръчки": work that did not come through the chat (a phone call, a friend's recommendation),
-- logged by the craftsman himself. A planned job is busy time in the public calendar, exactly like a
-- confirmed booking. Jobs and chat bookings can span several days (whole days).
--
-- Free plan: log busy time without limit (title, dates, optional hours, source, note).
-- Pro ('job_details', 'client_cards'): client card, materials, prices and the monthly report.

-- ---------------------------------------------------------------------------
-- Who may manage a craftsman's own data. Only the craftsman himself for now; companies extend this later.
-- ---------------------------------------------------------------------------
create or replace function public.can_manage_craftsman(p_craftsman uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_craftsman = (select auth.uid())
$$;
revoke execute on function public.can_manage_craftsman(uuid) from public, anon;
grant execute on function public.can_manage_craftsman(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.craftsman_clients (
  id uuid primary key default gen_random_uuid(),
  craftsman_id uuid not null references public.craftsman_profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  phone text check (char_length(phone) <= 40),
  address text check (char_length(address) <= 200),
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
create index craftsman_clients_idx on public.craftsman_clients (craftsman_id, name);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  craftsman_id uuid not null references public.craftsman_profiles (id) on delete cascade,
  client_id uuid references public.craftsman_clients (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,
  title text not null check (char_length(title) between 1 and 160),
  source text not null default 'phone'
    check (source in ('maistorko', 'recommendation', 'phone', 'facebook', 'other')),
  start_date date not null,
  end_date date not null,
  start_time time,
  end_time time,
  status text not null default 'planned' check (status in ('planned', 'done', 'cancelled')),
  note text check (char_length(note) <= 1000),
  materials_by_client boolean not null default false,
  labor_price numeric(10,2) check (labor_price is null or labor_price between 0 and 1000000),
  transport_price numeric(10,2) check (transport_price is null or transport_price between 0 and 1000000),
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (end_date - start_date <= 120),
  check ((start_time is null) = (end_time is null)),
  check (end_time is null or end_time > start_time),
  -- hours only for a single day; several days are whole days
  check (start_time is null or start_date = end_date)
);
create index jobs_craftsman_idx on public.jobs (craftsman_id, start_date);
create index jobs_busy_idx on public.jobs (craftsman_id, start_date, end_date) where status = 'planned';
create trigger jobs_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();

create table public.job_materials (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  craftsman_id uuid not null references public.craftsman_profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  qty text check (char_length(qty) <= 40),
  amount numeric(10,2) not null default 0 check (amount between 0 and 1000000),
  created_at timestamptz not null default now()
);
create index job_materials_job_idx on public.job_materials (job_id);

alter table public.craftsman_clients enable row level security;
alter table public.jobs enable row level security;
alter table public.job_materials enable row level security;

create policy "clients: manage own" on public.craftsman_clients
  for all to authenticated
  using (public.can_manage_craftsman(craftsman_id)) with check (public.can_manage_craftsman(craftsman_id));
create policy "jobs: manage own" on public.jobs
  for all to authenticated
  using (public.can_manage_craftsman(craftsman_id)) with check (public.can_manage_craftsman(craftsman_id));
create policy "job materials: manage own" on public.job_materials
  for all to authenticated
  using (public.can_manage_craftsman(craftsman_id)) with check (public.can_manage_craftsman(craftsman_id));

revoke all on public.craftsman_clients, public.jobs, public.job_materials from anon, authenticated;
grant select, insert, update, delete on public.craftsman_clients, public.jobs, public.job_materials to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers (not security definer: is_api_request() must see the API role)
-- ---------------------------------------------------------------------------
create or replace function public.enforce_job_pro()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_api_request() then return new; end if;
  if tg_table_name = 'jobs' then
    -- details are Pro; plain busy-time logging is always free
    if (new.client_id is not null or new.labor_price is not null or new.transport_price is not null)
       and (tg_op = 'INSERT' or (new.client_id, new.labor_price, new.transport_price)
            is distinct from (old.client_id, old.labor_price, old.transport_price))
       and not public.has_feature(new.craftsman_id, 'job_details') then
      raise exception 'Клиентска карта и цени към поръчка са в Pro.' using errcode = 'P0001';
    end if;
  elsif not public.has_feature(new.craftsman_id, case tg_table_name when 'craftsman_clients' then 'client_cards' else 'job_details' end) then
    raise exception 'Тази функция е в Pro.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger jobs_pro before insert or update on public.jobs
  for each row execute function public.enforce_job_pro();
create trigger clients_pro before insert on public.craftsman_clients
  for each row execute function public.enforce_job_pro();
create trigger materials_pro before insert on public.job_materials
  for each row execute function public.enforce_job_pro();

-- A job's client and a material's job must belong to the same craftsman.
-- Two functions: a plpgsql trigger may not mention a column the table does not have.
create or replace function public.check_job_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.client_id is not null
     and not exists (select 1 from public.craftsman_clients c where c.id = new.client_id and c.craftsman_id = new.craftsman_id) then
    raise exception 'Клиентът не е твой.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger jobs_owner before insert or update on public.jobs
  for each row execute function public.check_job_owner();

create or replace function public.check_material_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.jobs j where j.id = new.job_id and j.craftsman_id = new.craftsman_id) then
    raise exception 'Поръчката не е твоя.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger materials_owner before insert or update on public.job_materials
  for each row execute function public.check_material_owner();

create or replace function public.job_status_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then new.done_at := now();
  elsif new.status <> 'done' then new.done_at := null;
  end if;
  return new;
end;
$$;
create trigger jobs_stamp before insert or update on public.jobs
  for each row execute function public.job_status_stamp();

-- Keeping the calendar up to date counts as confirming it
create trigger jobs_touch after insert or update or delete on public.jobs
  for each row execute function public.touch_calendar_confirmation();

-- ---------------------------------------------------------------------------
-- Chat bookings may span several days (whole days)
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column end_date date,
  add constraint bookings_end_after_start check (end_date is null or end_date > booking_date),
  add constraint bookings_multiday_whole_days check (end_date is null or start_time is null),
  add constraint bookings_span check (end_date is null or end_date - booking_date <= 120);

create or replace function public.booking_label(b public.bookings)
returns text
language sql
immutable
set search_path = ''
as $$
  select case b.kind when 'inspection' then 'оглед' else 'работа' end
    || ' на ' || to_char(b.booking_date, 'DD.MM')
    || case when b.end_date is not null then '–' || to_char(b.end_date, 'DD.MM') || ', цели дни'
            when b.start_time is null then ', цял ден'
            else ', ' || to_char(b.start_time, 'HH24:MI') || '–' || to_char(b.end_time, 'HH24:MI') end
$$;

-- Overlap with other confirmed bookings and with planned jobs of the same craftsman
create or replace function public.booking_overlaps(b public.bookings)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select tsrange(b.booking_date + coalesce(b.start_time, time '00:00'),
                   case when b.end_time is null then (coalesce(b.end_date, b.booking_date) + 1)::timestamp
                        else b.booking_date + b.end_time end) as r
  )
  select exists (
    select 1 from public.bookings o, mine
    where o.craftsman_id = b.craftsman_id and o.id <> b.id and o.status = 'confirmed'
      and tsrange(o.booking_date + coalesce(o.start_time, time '00:00'),
                  case when o.end_time is null then (coalesce(o.end_date, o.booking_date) + 1)::timestamp
                       else o.booking_date + o.end_time end) && mine.r
  ) or exists (
    select 1 from public.jobs j, mine
    where j.craftsman_id = b.craftsman_id and j.status = 'planned'
      and tsrange(j.start_date + coalesce(j.start_time, time '00:00'),
                  case when j.end_time is null then (j.end_date + 1)::timestamp
                       else j.start_date + j.end_time end) && mine.r
  )
$$;

-- ---------------------------------------------------------------------------
-- Availability: planned jobs and multi-day bookings are busy on every day they cover.
-- Same precedence rule as before: the day's own exceptions beat a longer period when newer.
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
          and p_day between b.booking_date and coalesce(b.end_date, b.booking_date)
        union all
        select tsrange(
          p_day + coalesce(j.start_time, time '00:00'),
          case when j.end_time is null then (p_day + 1)::timestamp else p_day + j.end_time end)
        from public.jobs j
        where j.craftsman_id = p_craftsman and j.status = 'planned'
          and p_day between j.start_date and j.end_date
      ) s
    ), '{}'::tsmultirange)
$$;

-- propose_booking gets an optional end date (whole days); the old signature goes away
drop function public.propose_booking(uuid, date, time, time, text, text);

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
  v_by_craftsman boolean;
  v_end date := case when p_end_date is not null and p_end_date > p_date then p_end_date end;
begin
  if v_me is null then raise exception 'Влезте в профила си.' using errcode = '42501'; end if;
  if public.is_banned() then raise exception 'Профилът ви е блокиран.' using errcode = '42501'; end if;
  select * into v_conv from public.conversations where id = p_conversation;
  if v_conv.id is null or v_me not in (v_conv.client_id, v_conv.craftsman_id) then
    raise exception 'Разговорът не е намерен.' using errcode = '42501';
  end if;
  if p_date is null or p_date < (now() at time zone 'Europe/Sofia')::date then
    raise exception 'Изберете дата от днес нататък.';
  end if;
  if coalesce(v_end, p_date) > (now() at time zone 'Europe/Sofia')::date + 180 then
    raise exception 'Датата е твърде далеч.';
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

  v_by_craftsman := v_me = v_conv.craftsman_id;

  insert into public.bookings (conversation_id, craftsman_id, client_id, booking_date, end_date, start_time, end_time,
                               kind, status, note, proposed_by, responded_by)
  values (v_conv.id, v_conv.craftsman_id, v_conv.client_id, p_date, v_end, p_start, p_end, p_kind,
          case when v_by_craftsman then 'confirmed' else 'proposed' end,
          nullif(btrim(coalesce(p_note, '')), ''), v_me,
          case when v_by_craftsman then v_me end)
  returning * into v_b;

  if v_by_craftsman and public.booking_overlaps(v_b) then
    raise exception 'Вече имате потвърдена уговорка или поръчка в този период.';
  end if;

  insert into public.messages (conversation_id, sender_id, body, meta)
  values (v_conv.id, v_me,
          case when v_by_craftsman then 'Запазих ' || public.booking_label(v_b)
               else 'Предлагам ' || public.booking_label(v_b) end,
          jsonb_build_object('booking_id', v_b.id, 'event', case when v_by_craftsman then 'confirmed' else 'proposed' end));
  return v_b.id;
end;
$$;

drop function public.my_bookings(date);
create or replace function public.my_bookings(p_from date default null)
returns table (
  id uuid,
  conversation_id uuid,
  i_am text,
  partner_name text,
  partner_slug text,
  booking_date date,
  end_date date,
  start_time time,
  end_time time,
  kind text,
  status text,
  note text,
  proposed_by_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.conversation_id,
         case when b.client_id = auth.uid() then 'client' else 'craftsman' end,
         case when b.client_id = auth.uid() then cp.display_name
              else coalesce(nullif(pc.full_name, ''), 'Клиент') end,
         case when b.client_id = auth.uid() then cp.slug end,
         b.booking_date, b.end_date, b.start_time, b.end_time, b.kind, b.status, b.note,
         b.proposed_by = auth.uid()
  from public.bookings b
  join public.craftsman_profiles cp on cp.id = b.craftsman_id
  join public.profiles pc on pc.id = b.client_id
  where auth.uid() in (b.client_id, b.craftsman_id)
    and coalesce(b.end_date, b.booking_date) >= coalesce(p_from, (now() at time zone 'Europe/Sofia')::date)
    and b.status in ('proposed', 'confirmed')
  order by b.booking_date, b.start_time nulls first
$$;

-- ---------------------------------------------------------------------------
-- Monthly report (Pro): jobs, revenue, sources, most frequent work
-- ---------------------------------------------------------------------------
create or replace function public.job_report(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_result jsonb;
begin
  if v_me is null then raise exception 'Влезте в профила си.' using errcode = '42501'; end if;
  if not public.has_feature(v_me, 'reports') then
    raise exception 'Отчетът е в Pro.' using errcode = 'P0001';
  end if;
  if p_to < p_from or p_to - p_from > 400 then raise exception 'Невалиден период.'; end if;

  with js as (
    select j.*,
           coalesce((select sum(m.amount) from public.job_materials m where m.job_id = j.id), 0) as materials
    from public.jobs j
    where j.craftsman_id = v_me and j.start_date between p_from and p_to
  )
  select jsonb_build_object(
    'jobs', count(*) filter (where status <> 'cancelled'),
    'done', count(*) filter (where status = 'done'),
    'cancelled', count(*) filter (where status = 'cancelled'),
    'labor', coalesce(sum(labor_price) filter (where status = 'done'), 0),
    'transport', coalesce(sum(transport_price) filter (where status = 'done'), 0),
    'materials', coalesce(sum(materials) filter (where status = 'done' and not materials_by_client), 0),
    'by_source', coalesce((select jsonb_agg(jsonb_build_object('source', s.source, 'count', s.n) order by s.n desc)
                           from (select source, count(*) n from js where status <> 'cancelled' group by source) s), '[]'),
    'top_work', coalesce((select jsonb_agg(jsonb_build_object('title', t.title, 'count', t.n) order by t.n desc)
                          from (select min(title) as title, count(*) n from js where status <> 'cancelled'
                                group by lower(title) order by count(*) desc limit 5) t), '[]')
  ) into v_result
  from js;
  return v_result;
end;
$$;

revoke execute on function
  public.enforce_job_pro(), public.check_job_owner(), public.check_material_owner(), public.job_status_stamp(),
  public.booking_label(public.bookings), public.booking_overlaps(public.bookings),
  public.propose_booking(uuid, date, time, time, text, text, date),
  public.my_bookings(date), public.job_report(date, date)
  from public, anon, authenticated;
grant execute on function public.propose_booking(uuid, date, time, time, text, text, date) to authenticated;
grant execute on function public.my_bookings(date), public.job_report(date, date) to authenticated;
