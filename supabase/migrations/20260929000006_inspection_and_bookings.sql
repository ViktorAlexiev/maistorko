-- Майсторко: inspection terms, time slots in first messages, and bookings
-- agreed in chat. A confirmed booking removes its interval from the public
-- calendar. Still no payments: a booking is an agreed visit, not a purchase.

-- ---------------------------------------------------------------------------
-- Inspection & terms on the craftsman profile
-- ---------------------------------------------------------------------------
alter table public.craftsman_profiles
  add column inspection_policy text
    check (inspection_policy in ('free', 'paid', 'deducted', 'none')),
  add column inspection_fee numeric(8,2)
    check (inspection_fee is null or inspection_fee between 0 and 1000),
  add column terms_note text
    check (char_length(terms_note) <= 600),
  add constraint inspection_fee_needs_paid_policy
    check (inspection_fee is null or inspection_policy in ('paid', 'deducted'));

-- ---------------------------------------------------------------------------
-- Bookings (agreed visits). Created and changed only through the RPCs below.
-- ---------------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  craftsman_id uuid not null references public.craftsman_profiles (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  booking_date date not null,
  start_time time,
  end_time time,
  kind text not null check (kind in ('inspection', 'work')),
  status text not null default 'proposed'
    check (status in ('proposed', 'confirmed', 'declined', 'cancelled')),
  note text check (char_length(note) <= 300),
  proposed_by uuid not null references public.profiles (id) on delete cascade,
  responded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((start_time is null) = (end_time is null)),
  check (end_time is null or end_time > start_time)
);
create index bookings_craftsman_idx on public.bookings (craftsman_id, booking_date) where status = 'confirmed';
create index bookings_conversation_idx on public.bookings (conversation_id, created_at);
create index bookings_client_idx on public.bookings (client_id, booking_date);
create trigger bookings_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

alter table public.bookings enable row level security;

create policy "bookings: participants read" on public.bookings
  for select to authenticated
  using (auth.uid() in (client_id, craftsman_id));

revoke insert, update, delete on public.bookings from authenticated;
revoke all on public.bookings from anon;

alter publication supabase_realtime add table public.bookings;

-- ---------------------------------------------------------------------------
-- Availability engine: confirmed bookings are busy time.
-- Security definer so anonymous visitors get the right free/busy answer
-- without being able to read anyone's bookings.
-- ---------------------------------------------------------------------------
create or replace function public.day_free_ranges(p_craftsman uuid, p_day date)
returns tsmultirange
language sql
stable
security definer
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
      select range_agg(r) from (
        select tsrange(
          p_day + coalesce(e.start_time, time '00:00'),
          case when e.end_time is null then (p_day + 1)::timestamp else p_day + e.end_time end) as r
        from public.availability_exceptions e
        where e.craftsman_id = p_craftsman and e.kind = 'busy'
          and p_day between e.start_date and e.end_date
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

-- ---------------------------------------------------------------------------
-- First message can carry a preferred slot
-- ---------------------------------------------------------------------------
drop function if exists public.start_conversation(uuid, text, date, smallint);

create or replace function public.start_conversation(
  p_craftsman uuid,
  p_body text,
  p_date date default null,
  p_category smallint default null,
  p_slot text default null
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
  if p_slot is not null and p_slot !~ '^(morning|afternoon|evening|\d{2}:\d{2}-\d{2}:\d{2})$' then
    raise exception 'Невалиден час.';
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
  if p_date is not null and p_slot is not null then v_meta := v_meta || jsonb_build_object('slot', p_slot); end if;
  if p_category is not null then
    v_meta := v_meta || jsonb_build_object('category',
      (select name from public.categories where id = p_category));
  end if;

  insert into public.messages (conversation_id, sender_id, body, meta)
  values (v_conv, v_me, btrim(p_body), v_meta);
  return v_conv;
end;
$$;

-- ---------------------------------------------------------------------------
-- Booking RPCs. Each action also posts a message so the chat shows it and
-- Realtime delivers it to the other side.
-- ---------------------------------------------------------------------------
create or replace function public.booking_label(b public.bookings)
returns text
language sql
immutable
set search_path = ''
as $$
  select case b.kind when 'inspection' then 'оглед' else 'работа' end
    || ' на ' || to_char(b.booking_date, 'DD.MM')
    || case when b.start_time is null then ', цял ден'
            else ', ' || to_char(b.start_time, 'HH24:MI') || '–' || to_char(b.end_time, 'HH24:MI') end
$$;

create or replace function public.booking_overlaps(b public.bookings)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bookings o
    where o.craftsman_id = b.craftsman_id
      and o.id <> b.id
      and o.status = 'confirmed'
      and o.booking_date = b.booking_date
      and tsrange(o.booking_date + coalesce(o.start_time, time '00:00'),
                  case when o.end_time is null then (o.booking_date + 1)::timestamp else o.booking_date + o.end_time end)
       && tsrange(b.booking_date + coalesce(b.start_time, time '00:00'),
                  case when b.end_time is null then (b.booking_date + 1)::timestamp else b.booking_date + b.end_time end)
  )
$$;

-- A craftsman's proposal blocks his calendar right away (he controls it);
-- a client's proposal waits for the craftsman to confirm.
create or replace function public.propose_booking(
  p_conversation uuid,
  p_date date,
  p_start time default null,
  p_end time default null,
  p_kind text default 'work',
  p_note text default null
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
  if p_date > (now() at time zone 'Europe/Sofia')::date + 180 then
    raise exception 'Датата е твърде далеч.';
  end if;
  if (p_start is null) <> (p_end is null) or (p_start is not null and p_end <= p_start) then
    raise exception 'Краят трябва да е след началото.';
  end if;
  if p_kind not in ('inspection', 'work') then raise exception 'Невалиден вид уговорка.'; end if;

  v_by_craftsman := v_me = v_conv.craftsman_id;

  insert into public.bookings (conversation_id, craftsman_id, client_id, booking_date, start_time, end_time,
                               kind, status, note, proposed_by, responded_by)
  values (v_conv.id, v_conv.craftsman_id, v_conv.client_id, p_date, p_start, p_end, p_kind,
          case when v_by_craftsman then 'confirmed' else 'proposed' end,
          nullif(btrim(coalesce(p_note, '')), ''), v_me,
          case when v_by_craftsman then v_me end)
  returning * into v_b;

  if v_by_craftsman and public.booking_overlaps(v_b) then
    raise exception 'Вече имате потвърдена уговорка в този интервал.';
  end if;

  insert into public.messages (conversation_id, sender_id, body, meta)
  values (v_conv.id, v_me,
          case when v_by_craftsman then 'Запазих ' || public.booking_label(v_b)
               else 'Предлагам ' || public.booking_label(v_b) end,
          jsonb_build_object('booking_id', v_b.id, 'event', case when v_by_craftsman then 'confirmed' else 'proposed' end));
  return v_b.id;
end;
$$;

create or replace function public.respond_booking(p_booking uuid, p_action text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_b public.bookings;
  v_new text;
  v_body text;
begin
  if v_me is null then raise exception 'Влезте в профила си.' using errcode = '42501'; end if;
  select * into v_b from public.bookings where id = p_booking for update;
  if v_b.id is null or v_me not in (v_b.client_id, v_b.craftsman_id) then
    raise exception 'Уговорката не е намерена.' using errcode = '42501';
  end if;

  if p_action in ('confirm', 'decline') then
    if v_b.status <> 'proposed' then raise exception 'Уговорката вече не чака отговор.'; end if;
    if v_me = v_b.proposed_by then raise exception 'Другата страна трябва да отговори.'; end if;
    v_new := case p_action when 'confirm' then 'confirmed' else 'declined' end;
    if v_new = 'confirmed' then
      v_b.status := 'confirmed';
      if public.booking_overlaps(v_b) then
        raise exception 'Майсторът вече има потвърдена уговорка в този интервал.';
      end if;
    end if;
  elsif p_action = 'cancel' then
    if v_b.status not in ('proposed', 'confirmed') then raise exception 'Уговорката вече е приключена.'; end if;
    if v_b.status = 'proposed' and v_me <> v_b.proposed_by then
      raise exception 'Можете да откажете предложението.';
    end if;
    v_new := 'cancelled';
  else
    raise exception 'Невалидно действие.';
  end if;

  update public.bookings set status = v_new, responded_by = v_me where id = v_b.id returning * into v_b;

  v_body := case v_new
    when 'confirmed' then 'Потвърдих ' || public.booking_label(v_b)
    when 'declined' then 'Не мога за ' || public.booking_label(v_b)
    else 'Отмених ' || public.booking_label(v_b) end;
  insert into public.messages (conversation_id, sender_id, body, meta)
  values (v_b.conversation_id, v_me, v_body, jsonb_build_object('booking_id', v_b.id, 'event', v_new));
  return v_new;
end;
$$;

-- Upcoming bookings for the signed-in user (dashboards, calendar editor)
create or replace function public.my_bookings(p_from date default null)
returns table (
  id uuid,
  conversation_id uuid,
  i_am text,
  partner_name text,
  partner_slug text,
  booking_date date,
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
         b.booking_date, b.start_time, b.end_time, b.kind, b.status, b.note,
         b.proposed_by = auth.uid()
  from public.bookings b
  join public.craftsman_profiles cp on cp.id = b.craftsman_id
  join public.profiles pc on pc.id = b.client_id
  where auth.uid() in (b.client_id, b.craftsman_id)
    and b.booking_date >= coalesce(p_from, (now() at time zone 'Europe/Sofia')::date)
    and b.status in ('proposed', 'confirmed')
  order by b.booking_date, b.start_time nulls first
$$;

revoke execute on function public.booking_label(public.bookings), public.booking_overlaps(public.bookings)
  from public, anon, authenticated;
grant execute on function public.day_free_ranges(uuid, date) to anon, authenticated;
grant execute on function public.start_conversation(uuid, text, date, smallint, text) to authenticated;
grant execute on function
  public.propose_booking(uuid, date, time, time, text, text),
  public.respond_booking(uuid, text),
  public.my_bookings(date)
to authenticated;
revoke execute on function
  public.propose_booking(uuid, date, time, time, text, text),
  public.respond_booking(uuid, text),
  public.my_bookings(date),
  public.start_conversation(uuid, text, date, smallint, text)
from public, anon;
