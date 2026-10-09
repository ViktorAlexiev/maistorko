-- Chat with a company ("Пиши на фирмата"). A conversation is either personal (client <-> craftsman, as before)
-- or with a company: the client writes to the company, its owner and managers answer from a shared inbox,
-- and a manager can hand the conversation to one of the company's craftsmen, who then takes part in it
-- (and can book visits from it). Personal chats stay private: managers can never read them.

alter table public.conversations
  alter column craftsman_id drop not null,
  add column org_id uuid references public.organizations (id) on delete cascade,
  add column assigned_to uuid references public.profiles (id) on delete set null,
  add constraint conversations_one_counterpart check ((craftsman_id is not null) <> (org_id is not null));
create unique index conversations_client_org_idx on public.conversations (client_id, org_id) where org_id is not null;
create index conversations_org_idx on public.conversations (org_id, last_message_at desc) where org_id is not null;
create index conversations_assigned_idx on public.conversations (assigned_to) where assigned_to is not null;

-- ---------------------------------------------------------------------------
-- Who takes part in a conversation
-- ---------------------------------------------------------------------------
create or replace function public.is_conv_party(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation
      and ((select auth.uid()) in (c.client_id, c.craftsman_id, c.assigned_to)
           or (c.org_id is not null and public.is_org_manager(c.org_id)))
  )
$$;

create or replace function public.is_conversation_member(p_conversation text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_conversation ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and public.is_conv_party(p_conversation::uuid)
$$;

drop policy "conversations: participants read" on public.conversations;
create policy "conversations: participants read" on public.conversations
  for select to authenticated using (public.is_conv_party(id));

drop policy "messages: participants read" on public.messages;
create policy "messages: participants read" on public.messages
  for select to authenticated using (public.is_conv_party(conversation_id));

drop policy "messages: participants send" on public.messages;
create policy "messages: participants send" on public.messages
  for insert to authenticated
  with check (sender_id = (select auth.uid()) and not public.is_banned() and public.is_conv_party(conversation_id));

-- ---------------------------------------------------------------------------
-- The client starts a conversation with a company
-- ---------------------------------------------------------------------------
create or replace function public.start_org_conversation(
  p_org uuid, p_body text, p_date date default null, p_category smallint default null)
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
  if p_body is null or char_length(btrim(p_body)) < 1 then raise exception 'Съобщението е празно.'; end if;
  if char_length(p_body) > 4000 then raise exception 'Съобщението е твърде дълго.'; end if;
  if p_date is not null and p_date < (now() at time zone 'Europe/Sofia')::date then raise exception 'Датата е в миналото.'; end if;
  if not exists (select 1 from public.organizations o where o.id = p_org and not o.is_hidden) then
    raise exception 'Фирмата не е намерена.';
  end if;
  if exists (select 1 from public.organization_members m where m.organization_id = p_org and m.user_id = v_me) then
    raise exception 'Не можете да пишете на собствената си фирма.';
  end if;

  insert into public.conversations (client_id, org_id, requested_date, category_id)
  values (v_me, p_org, p_date, p_category)
  on conflict (client_id, org_id) where org_id is not null do update
    set requested_date = coalesce(excluded.requested_date, public.conversations.requested_date),
        category_id = coalesce(excluded.category_id, public.conversations.category_id)
  returning id into v_conv;

  if p_date is not null then v_meta := v_meta || jsonb_build_object('date', p_date); end if;
  if p_category is not null then
    v_meta := v_meta || jsonb_build_object('category', (select name from public.categories where id = p_category));
  end if;
  insert into public.messages (conversation_id, sender_id, body, meta) values (v_conv, v_me, btrim(p_body), v_meta);
  return v_conv;
end;
$$;

-- A manager hands a company conversation to one of the company's craftsmen (null takes it back)
create or replace function public.assign_org_conversation(p_conversation uuid, p_craftsman uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.conversations;
  v_name text;
begin
  select * into c from public.conversations where id = p_conversation for update;
  if c.id is null or c.org_id is null or not public.is_org_manager(c.org_id) then
    raise exception 'Нямате право.' using errcode = '42501';
  end if;
  if p_craftsman is not null then
    if not exists (select 1 from public.organization_members m
                   where m.organization_id = c.org_id and m.user_id = p_craftsman
                     and exists (select 1 from public.craftsman_profiles cp where cp.id = m.user_id)) then
      raise exception 'Този човек не е майстор във вашата фирма.';
    end if;
  end if;
  update public.conversations set assigned_to = p_craftsman where id = c.id;

  select cp.display_name into v_name from public.craftsman_profiles cp where cp.id = p_craftsman;
  insert into public.messages (conversation_id, sender_id, body, meta)
  values (c.id, auth.uid(),
          case when p_craftsman is null then 'Разговорът пак е при фирмата.' else v_name || ' поема разговора.' end,
          jsonb_build_object('event', 'assigned'));
end;
$$;

-- ---------------------------------------------------------------------------
-- Message trigger: notify the other side. For a company conversation the client's message goes to the owner,
-- the managers and the assigned craftsman; an answer from staff goes to the client.
-- ---------------------------------------------------------------------------
create or replace function public.on_message_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conv public.conversations;
  v_sender text;
  v_org_name text;
  v_booking boolean := new.meta ? 'booking_id';
  v_kind text;
  v_title text;
  v_preview text := left(regexp_replace(new.body, '\s+', ' ', 'g'), 300);
  r record;
begin
  update public.conversations c set
    last_message_at = new.created_at,
    last_message_preview = left(regexp_replace(new.body, '\s+', ' ', 'g'), 140),
    last_sender_id = new.sender_id,
    client_last_read_at = case when new.sender_id = c.client_id then new.created_at else c.client_last_read_at end,
    craftsman_last_read_at = case when new.sender_id <> c.client_id then new.created_at else c.craftsman_last_read_at end,
    craftsman_replied_at = case when new.sender_id = c.craftsman_id then coalesce(c.craftsman_replied_at, new.created_at)
                                else c.craftsman_replied_at end
  where c.id = new.conversation_id
  returning * into v_conv;

  select coalesce(nullif(cp.display_name, ''), nullif(p.full_name, ''), 'Някой') into v_sender
  from public.profiles p left join public.craftsman_profiles cp on cp.id = p.id
  where p.id = new.sender_id;
  v_kind := case when v_booking then 'booking' else 'message' end;

  if v_conv.org_id is null then
    perform public.push_notification(
      case when new.sender_id = v_conv.client_id then v_conv.craftsman_id else v_conv.client_id end,
      v_kind,
      case when v_booking then v_sender || ': уговорка' else 'Ново съобщение от ' || v_sender end,
      v_preview, '/saobshtenia/' || v_conv.id, v_conv.id);
    return null;
  end if;

  select o.name into v_org_name from public.organizations o where o.id = v_conv.org_id;
  if new.sender_id = v_conv.client_id then
    -- the client wrote: the company's staff
    v_title := 'Ново съобщение до ' || v_org_name || ' от ' || v_sender;
    for r in
      select m.user_id from public.organization_members m
      where m.organization_id = v_conv.org_id and m.role in ('owner', 'manager')
      union select v_conv.assigned_to where v_conv.assigned_to is not null
    loop
      perform public.push_notification(r.user_id, v_kind, v_title, v_preview, '/saobshtenia/' || v_conv.id, v_conv.id);
    end loop;
  else
    -- staff wrote: the client; and the assigned craftsman when someone else answered
    perform public.push_notification(v_conv.client_id, v_kind,
      case when v_booking then v_org_name || ': уговорка' else 'Ново съобщение от ' || v_org_name end,
      v_preview, '/saobshtenia/' || v_conv.id, v_conv.id);
    if v_conv.assigned_to is not null and new.sender_id <> v_conv.assigned_to then
      perform public.push_notification(v_conv.assigned_to, v_kind, v_sender || ' пише в ваш разговор', v_preview,
        '/saobshtenia/' || v_conv.id, v_conv.id);
    end if;
  end if;
  return null;
end;
$$;

create or replace function public.mark_conversation_read(p_conversation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_conv_party(p_conversation) then return; end if;
  update public.conversations c set
    client_last_read_at = case when c.client_id = auth.uid() then now() else c.client_last_read_at end,
    craftsman_last_read_at = case when c.client_id <> auth.uid() then now() else c.craftsman_last_read_at end
  where c.id = p_conversation;
  update public.notifications set read_at = now()
  where user_id = auth.uid() and conversation_id = p_conversation and read_at is null;
end;
$$;

-- The list of my conversations: personal ones, company ones I answer as staff, and ones assigned to me
drop function public.unread_total();
drop function public.my_conversations();
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
  unread_count int,
  org_id uuid,
  org_name text,
  org_slug text,
  assigned_to uuid,
  assigned_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id,
         case when c.client_id = auth.uid() then 'client' else 'craftsman' end,
         case when c.client_id = auth.uid() then coalesce(c.craftsman_id, c.org_id) else c.client_id end,
         case when c.client_id = auth.uid() then coalesce(cp.display_name, o.name)
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
                                    then c.client_last_read_at else c.craftsman_last_read_at end),
         c.org_id, o.name, o.slug, c.assigned_to, ac.display_name
  from public.conversations c
  left join public.craftsman_profiles cp on cp.id = c.craftsman_id
  left join public.organizations o on o.id = c.org_id
  left join public.craftsman_profiles ac on ac.id = c.assigned_to
  join public.profiles pc on pc.id = c.client_id
  left join public.categories cat on cat.id = c.category_id
  where public.is_conv_party(c.id)
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

-- Booking from a company conversation: the assigned craftsman is the craftsman of the visit
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

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function
  public.is_conv_party(uuid), public.is_conversation_member(text),
  public.start_org_conversation(uuid, text, date, smallint), public.assign_org_conversation(uuid, uuid),
  public.on_message_insert(), public.mark_conversation_read(uuid), public.my_conversations(), public.unread_total(),
  public.propose_booking(uuid, date, time, time, text, text, date)
  from public, anon, authenticated;
grant execute on function public.is_conv_party(uuid), public.is_conversation_member(text), public.my_conversations(),
  public.unread_total(), public.mark_conversation_read(uuid), public.start_org_conversation(uuid, text, date, smallint),
  public.assign_org_conversation(uuid, uuid), public.propose_booking(uuid, date, time, time, text, text, date)
  to authenticated;

-- Reporting a company conversation: the report is about the person on the other side
create or replace function public.report_content(p_type text, p_target uuid, p_reason text, p_details text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_user uuid;
begin
  if v_me is null then raise exception 'Влезте в профила си, за да докладвате.' using errcode = '42501'; end if;
  if p_reason not in ('spam', 'scam', 'offensive', 'fake', 'other') then raise exception 'Изберете причина.'; end if;
  if char_length(coalesce(p_details, '')) > 1000 then raise exception 'Описанието е до 1000 символа.'; end if;

  if p_type = 'profile' then
    select c.id into v_user from public.craftsman_profiles c where c.id = p_target;
  elsif p_type = 'conversation' then
    select case when v_me = c.client_id
                then coalesce(c.craftsman_id, c.assigned_to,
                              (select m.user_id from public.organization_members m where m.organization_id = c.org_id and m.role = 'owner' limit 1))
                else c.client_id end
      into v_user
    from public.conversations c where c.id = p_target and public.is_conv_party(c.id);
  elsif p_type = 'review' then
    select r.client_id into v_user from public.reviews r where r.id = p_target;
  else
    raise exception 'Невалиден вид доклад.';
  end if;
  if v_user is null then raise exception 'Не е намерено.'; end if;
  if v_user = v_me then raise exception 'Не можете да докладвате себе си.'; end if;

  if exists (select 1 from public.reports where reporter_id = v_me and target_type = p_type and target_id = p_target and status = 'new') then
    return;
  end if;
  if (select count(*) from public.reports where reporter_id = v_me and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Днес изпратихте много доклади. Опитайте утре.';
  end if;

  insert into public.reports (reporter_id, target_type, target_id, target_user, reason, details)
  values (v_me, p_type, p_target, v_user, p_reason, nullif(btrim(coalesce(p_details, '')), ''));
end;
$$;
revoke execute on function public.report_content(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.report_content(text, uuid, text, text) to authenticated;
