-- Notifications (bell + e-mail with a delay), review invites (leave a review by link),
-- and retention: conversations idle for 60 days lose their message texts.
-- E-mails are only queued here; a worker (web/scripts/worker.ts) sends them.

-- ---------------------------------------------------------------------------
-- Conversations: remember that the craftsman replied (reviews must survive the cleanup)
-- ---------------------------------------------------------------------------
alter table public.conversations
  add column craftsman_replied_at timestamptz,
  add column messages_purged_at timestamptz;

update public.conversations c set craftsman_replied_at = (
  select min(m.created_at) from public.messages m where m.conversation_id = c.id and m.sender_id = c.craftsman_id
);

create or replace function public.can_review(p_craftsman uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and auth.uid() <> p_craftsman
     and not public.is_banned()
     and exists (
       select 1 from public.conversations c
       where c.client_id = auth.uid() and c.craftsman_id = p_craftsman
         and c.craftsman_replied_at is not null
     )
$$;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('message', 'booking', 'review', 'calendar', 'system')),
  title text not null check (char_length(title) <= 200),
  body text check (char_length(body) <= 500),
  link text check (char_length(link) <= 300),
  conversation_id uuid references public.conversations (id) on delete cascade,
  count integer not null default 1,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
create index notifications_conv_idx on public.notifications (user_id, conversation_id) where read_at is null;

alter table public.notifications enable row level security;
create policy "notifications: own" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
alter publication supabase_realtime add table public.notifications;

create table public.notification_prefs (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  email_messages boolean not null default true,
  email_bookings boolean not null default true,
  email_reviews boolean not null default true,
  email_calendar boolean not null default true,
  unsub_token uuid not null default gen_random_uuid() unique
);
alter table public.notification_prefs enable row level security;
create policy "prefs: own read" on public.notification_prefs for select to authenticated using (user_id = (select auth.uid()));
create policy "prefs: own insert" on public.notification_prefs for insert to authenticated with check (user_id = (select auth.uid()));
create policy "prefs: own update" on public.notification_prefs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.notification_prefs from anon, authenticated;
grant select, insert on public.notification_prefs to authenticated;
grant update (email_messages, email_bookings, email_reviews, email_calendar) on public.notification_prefs to authenticated;

-- Only the worker (service role) touches the outbox
create table public.email_outbox (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  notification_id bigint references public.notifications (id) on delete set null,
  to_email text not null,
  subject text not null,
  body text not null,
  link text,
  unsub_token uuid,
  send_after timestamptz not null,
  sent_at timestamptz,
  attempts integer not null default 0,
  error text,
  created_at timestamptz not null default now()
);
create index email_outbox_due_idx on public.email_outbox (send_after) where sent_at is null;
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Creating notifications (and queueing the e-mail)
-- ---------------------------------------------------------------------------
create or replace function public.queue_email(p_notification bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n public.notifications;
  v_prefs public.notification_prefs;
  v_email text;
  v_allowed boolean;
  v_delay interval;
  v_subject text;
begin
  select * into n from public.notifications where id = p_notification;
  if n.id is null then return; end if;

  insert into public.notification_prefs (user_id) values (n.user_id) on conflict do nothing;
  select * into v_prefs from public.notification_prefs where user_id = n.user_id;

  v_allowed := case n.kind
    when 'message' then v_prefs.email_messages
    when 'booking' then v_prefs.email_bookings
    when 'review' then v_prefs.email_reviews
    when 'calendar' then v_prefs.email_calendar
    else true end;
  if not v_allowed then return; end if;

  select u.email::text into v_email from auth.users u where u.id = n.user_id;
  if v_email is null or v_email = '' then return; end if;

  v_delay := case n.kind when 'message' then interval '10 minutes' when 'booking' then interval '3 minutes' else interval '0' end;
  v_subject := case n.kind
    when 'message' then 'Ново съобщение в Майсторлъка'
    when 'booking' then 'Уговорка в Майсторлъка'
    when 'review' then 'Нов отзив в Майсторлъка'
    when 'calendar' then 'Календарът ти още ли е верен?'
    else 'Майсторлъка' end;

  insert into public.email_outbox (user_id, notification_id, to_email, subject, body, link, unsub_token, send_after)
  values (n.user_id, n.id, v_email, v_subject, n.title || coalesce(E'\n\n' || n.body, ''), n.link, v_prefs.unsub_token, now() + v_delay);
end;
$$;

create or replace function public.push_notification(
  p_user uuid, p_kind text, p_title text, p_body text, p_link text, p_conversation uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if p_user is null or not exists (select 1 from public.profiles where id = p_user and not is_banned) then
    return null;
  end if;

  -- Several messages in one conversation stay one notification (and one pending e-mail)
  if p_kind = 'message' and p_conversation is not null then
    update public.notifications set
      title = left(p_title, 200), body = left(p_body, 500), created_at = now(), count = count + 1
    where user_id = p_user and conversation_id = p_conversation and kind = 'message' and read_at is null
    returning id into v_id;
    if v_id is not null then
      update public.email_outbox set body = left(p_title, 200) || coalesce(E'\n\n' || left(p_body, 500), '')
      where notification_id = v_id and sent_at is null;
      return v_id;
    end if;
  end if;

  insert into public.notifications (user_id, kind, title, body, link, conversation_id)
  values (p_user, p_kind, left(p_title, 200), left(p_body, 500), p_link, p_conversation)
  returning id into v_id;
  perform public.queue_email(v_id);
  return v_id;
end;
$$;

create or replace function public.mark_notifications_read(p_ids bigint[] default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_n integer;
begin
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Reading a conversation marks its notifications read too (so the pending e-mail is skipped)
create or replace function public.mark_conversation_read(p_conversation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations c set
    client_last_read_at = case when c.client_id = auth.uid() then now() else c.client_last_read_at end,
    craftsman_last_read_at = case when c.craftsman_id = auth.uid() then now() else c.craftsman_last_read_at end
  where c.id = p_conversation and auth.uid() in (c.client_id, c.craftsman_id);
  update public.notifications set read_at = now()
  where user_id = auth.uid() and conversation_id = p_conversation and read_at is null;
end;
$$;

create or replace function public.unsubscribe_emails(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notification_prefs set
    email_messages = false, email_bookings = false, email_reviews = false, email_calendar = false
  where unsub_token = p_token;
  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- Message trigger: previews, reply stamp and the notification
-- ---------------------------------------------------------------------------
create or replace function public.on_message_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conv public.conversations;
  v_recipient uuid;
  v_sender text;
  v_booking boolean := new.meta ? 'booking_id';
begin
  update public.conversations c set
    last_message_at = new.created_at,
    last_message_preview = left(regexp_replace(new.body, '\s+', ' ', 'g'), 140),
    last_sender_id = new.sender_id,
    client_last_read_at = case when new.sender_id = c.client_id then new.created_at else c.client_last_read_at end,
    craftsman_last_read_at = case when new.sender_id = c.craftsman_id then new.created_at else c.craftsman_last_read_at end,
    craftsman_replied_at = case when new.sender_id = c.craftsman_id then coalesce(c.craftsman_replied_at, new.created_at)
                                else c.craftsman_replied_at end
  where c.id = new.conversation_id
  returning * into v_conv;

  v_recipient := case when new.sender_id = v_conv.client_id then v_conv.craftsman_id else v_conv.client_id end;
  select coalesce(nullif(cp.display_name, ''), nullif(p.full_name, ''), 'Някой') into v_sender
  from public.profiles p left join public.craftsman_profiles cp on cp.id = p.id
  where p.id = new.sender_id;

  perform public.push_notification(
    v_recipient,
    case when v_booking then 'booking' else 'message' end,
    case when v_booking then v_sender || ': уговорка' else 'Ново съобщение от ' || v_sender end,
    left(regexp_replace(new.body, '\s+', ' ', 'g'), 300),
    '/saobshtenia/' || v_conv.id,
    v_conv.id);
  return null;
end;
$$;

-- New review: tell the craftsman
create or replace function public.on_review_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_slug text;
begin
  select slug into v_slug from public.craftsman_profiles where id = new.craftsman_id;
  perform public.push_notification(
    new.craftsman_id, 'review', 'Нов отзив: ' || new.rating || ' от 5',
    nullif(left(new.body, 200), ''), '/maistori/' || v_slug || '#otzivi');
  return null;
end;
$$;
create trigger reviews_notify after insert on public.reviews
  for each row execute function public.on_review_insert();

-- Weekly: craftsmen whose calendar has not been confirmed for a week
create or replace function public.queue_calendar_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_n integer := 0;
begin
  for r in
    select c.id, (now() - c.last_confirmed_at) as age
    from public.craftsman_profiles c
    join public.profiles p on p.id = c.id
    where c.last_confirmed_at < now() - interval '7 days'
      and not c.is_hidden and not p.is_banned
      and exists (select 1 from public.availability_rules a where a.craftsman_id = c.id)
      and not exists (select 1 from public.notifications n
                      where n.user_id = c.id and n.kind = 'calendar' and n.created_at > now() - interval '6 days')
  loop
    perform public.push_notification(
      r.id, 'calendar', 'Календарът ти още ли е верен?',
      'Не си го потвърждавал от ' || extract(day from r.age)::int || ' дни. Клиентите разчитат на него. Отвори го и натисни „Всичко е вярно“.',
      '/tabla/kalendar');
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Retention: after p_days without a message the texts are deleted. Who talked to whom, when,
-- the bookings and the reviews stay.
-- ---------------------------------------------------------------------------
create or replace function public.cleanup_old_chats(p_days integer default 60)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  with old as (
    select id from public.conversations
    where last_message_at < now() - make_interval(days => p_days) and messages_purged_at is null
  ), gone as (
    delete from public.messages m using old where m.conversation_id = old.id returning m.conversation_id
  )
  update public.conversations c set messages_purged_at = now(), last_message_preview = ''
  from (select distinct conversation_id from gone) g
  where c.id = g.conversation_id;
  get diagnostics v_n = row_count;

  delete from public.notifications where read_at is not null and read_at < now() - interval '90 days';
  delete from public.email_outbox where sent_at is not null and sent_at < now() - interval '30 days';
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Review invites: the craftsman sends a link, the client (also a phone customer) signs in and rates
-- ---------------------------------------------------------------------------
create table public.review_invites (
  token uuid primary key default gen_random_uuid(),
  craftsman_id uuid not null references public.craftsman_profiles (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 days',
  used_by uuid references public.profiles (id) on delete set null,
  used_at timestamptz
);
create index review_invites_craftsman_idx on public.review_invites (craftsman_id, created_at desc);
alter table public.review_invites enable row level security;
create policy "invites: owner reads" on public.review_invites for select to authenticated
  using (public.can_manage_craftsman(craftsman_id));
revoke all on public.review_invites from anon, authenticated;
grant select on public.review_invites to authenticated;

create or replace function public.create_review_invite(p_job uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_token uuid;
begin
  if v_me is null or not exists (select 1 from public.craftsman_profiles where id = v_me) then
    raise exception 'Нямате профил на майстор.' using errcode = '42501';
  end if;
  if p_job is not null and not exists (select 1 from public.jobs where id = p_job and craftsman_id = v_me) then
    raise exception 'Поръчката не е намерена.' using errcode = '42501';
  end if;
  if (select count(*) from public.review_invites
      where craftsman_id = v_me and used_at is null and expires_at > now()) >= 50 then
    raise exception 'Имаш твърде много неизползвани покани за отзив.';
  end if;
  -- the same job gets the same open link
  if p_job is not null then
    select token into v_token from public.review_invites
    where job_id = p_job and used_at is null and expires_at > now() limit 1;
    if v_token is not null then return v_token; end if;
  end if;
  insert into public.review_invites (craftsman_id, job_id) values (v_me, p_job) returning token into v_token;
  return v_token;
end;
$$;

-- What the public review page may show (no private data)
create or replace function public.review_invite_info(p_token uuid)
returns table (craftsman_name text, craftsman_slug text, avatar_url text, state text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.display_name, c.slug, c.avatar_url,
         case when i.used_at is not null then 'used'
              when i.expires_at < now() then 'expired'
              else 'open' end
  from public.review_invites i
  join public.craftsman_profiles c on c.id = i.craftsman_id
  where i.token = p_token
$$;

create or replace function public.submit_review_by_token(p_token uuid, p_rating integer, p_body text default '')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  i public.review_invites;
begin
  if v_me is null then raise exception 'Влезте в профила си, за да оставите отзив.' using errcode = '42501'; end if;
  if public.is_banned() then raise exception 'Профилът ви е блокиран.' using errcode = '42501'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'Изберете оценка от 1 до 5.'; end if;
  if char_length(coalesce(p_body, '')) > 1000 then raise exception 'Отзивът е до 1000 символа.'; end if;

  select * into i from public.review_invites where token = p_token for update;
  if i.token is null then raise exception 'Линкът не е валиден.'; end if;
  if i.used_at is not null then raise exception 'Този линк вече е използван.'; end if;
  if i.expires_at < now() then raise exception 'Линкът е изтекъл.'; end if;
  if i.craftsman_id = v_me then raise exception 'Не можете да оставите отзив за себе си.'; end if;

  insert into public.reviews (craftsman_id, client_id, rating, body)
  values (i.craftsman_id, v_me, p_rating, coalesce(btrim(p_body), ''))
  on conflict (craftsman_id, client_id) do update set rating = excluded.rating, body = excluded.body;

  update public.review_invites set used_by = v_me, used_at = now() where token = p_token;
  return (select slug from public.craftsman_profiles where id = i.craftsman_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants (new functions are executable by PUBLIC unless revoked)
-- ---------------------------------------------------------------------------
revoke execute on function
  public.queue_email(bigint), public.push_notification(uuid, text, text, text, text, uuid),
  public.mark_notifications_read(bigint[]), public.mark_conversation_read(uuid),
  public.unsubscribe_emails(uuid), public.on_message_insert(), public.on_review_insert(),
  public.queue_calendar_reminders(), public.cleanup_old_chats(integer),
  public.create_review_invite(uuid), public.review_invite_info(uuid),
  public.submit_review_by_token(uuid, integer, text), public.can_review(uuid)
  from public, anon, authenticated;
grant execute on function
  public.mark_notifications_read(bigint[]), public.mark_conversation_read(uuid),
  public.create_review_invite(uuid), public.submit_review_by_token(uuid, integer, text)
  to authenticated;
grant execute on function public.can_review(uuid) to authenticated;
grant execute on function public.unsubscribe_emails(uuid), public.review_invite_info(uuid) to anon, authenticated;
