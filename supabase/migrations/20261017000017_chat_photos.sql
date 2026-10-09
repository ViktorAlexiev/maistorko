-- Photos in chats, and showing a chat photo in the craftsman's portfolio.
-- Chat photos live in a PRIVATE bucket: only the two people in the conversation can read them.
-- A photo sent by the client goes to the portfolio only after the client says yes in the chat.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-photos', 'chat-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path convention: chat-photos/<conversation id>/<file>
create or replace function public.is_conversation_member(p_conversation text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    where c.id::text = p_conversation and (select auth.uid()) in (c.client_id, c.craftsman_id)
  )
$$;
revoke execute on function public.is_conversation_member(text) from public, anon;
grant execute on function public.is_conversation_member(text) to authenticated;

create policy "chat photos: participants read" on storage.objects
  for select to authenticated
  using (bucket_id = 'chat-photos' and public.is_conversation_member((storage.foldername(name))[1]));

create policy "chat photos: participants upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-photos'
    and public.is_conversation_member((storage.foldername(name))[1])
    and not public.is_banned()
  );

create policy "chat photos: uploader deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'chat-photos' and owner_id = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- A message may carry photos: meta.photos = [{"path": "<conversation id>/<file>"}], at most 6,
-- each inside the message's own conversation folder.
-- ---------------------------------------------------------------------------
create or replace function public.check_message_photos()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_photo jsonb;
begin
  if not (new.meta ? 'photos') then return new; end if;
  if jsonb_typeof(new.meta -> 'photos') <> 'array' or jsonb_array_length(new.meta -> 'photos') > 6 then
    raise exception 'Най-много 6 снимки в едно съобщение.' using errcode = 'P0001';
  end if;
  for v_photo in select * from jsonb_array_elements(new.meta -> 'photos') loop
    if jsonb_typeof(v_photo) <> 'object' or (v_photo ->> 'path') is null
       or (v_photo ->> 'path') !~ ('^' || new.conversation_id::text || '/[A-Za-z0-9._-]+$') then
      raise exception 'Невалидна снимка.' using errcode = 'P0001';
    end if;
  end loop;
  return new;
end;
$$;
create trigger messages_photos before insert on public.messages
  for each row execute function public.check_message_photos();

-- ---------------------------------------------------------------------------
-- "Show this photo in my profile" with the client's consent
-- ---------------------------------------------------------------------------
create table public.photo_share_requests (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  message_id bigint not null references public.messages (id) on delete cascade,
  path text not null,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (message_id, path)
);
alter table public.photo_share_requests enable row level security;
create policy "share requests: participants read" on public.photo_share_requests
  for select to authenticated using (public.is_conversation_member(conversation_id::text));
revoke all on public.photo_share_requests from anon, authenticated;
grant select on public.photo_share_requests to authenticated;
alter publication supabase_realtime add table public.photo_share_requests;

-- The craftsman asks the client about one of the client's photos
create or replace function public.request_photo_share(p_message bigint, p_path text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_msg public.messages;
  v_conv public.conversations;
  v_id uuid;
begin
  if v_me is null then raise exception 'Влезте в профила си.' using errcode = '42501'; end if;
  select * into v_msg from public.messages where id = p_message;
  select * into v_conv from public.conversations where id = v_msg.conversation_id;
  if v_conv.id is null or v_me <> v_conv.craftsman_id then
    raise exception 'Само майсторът може да пита.' using errcode = '42501';
  end if;
  if v_msg.sender_id <> v_conv.client_id
     or not (v_msg.meta -> 'photos' @> jsonb_build_array(jsonb_build_object('path', p_path))) then
    raise exception 'Тази снимка не е на клиента.';
  end if;
  select id into v_id from public.photo_share_requests where message_id = p_message and path = p_path;
  if v_id is not null then return v_id; end if;

  insert into public.photo_share_requests (conversation_id, message_id, path, requested_by)
  values (v_conv.id, p_message, p_path, v_me) returning id into v_id;
  insert into public.messages (conversation_id, sender_id, body, meta)
  values (v_conv.id, v_me, 'Питам дали мога да покажа тази снимка в профила си (без име и адрес).',
          jsonb_build_object('share_request', v_id, 'event', 'asked'));
  return v_id;
end;
$$;

-- The client answers
create or replace function public.respond_photo_share(p_request uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  r public.photo_share_requests;
  v_conv public.conversations;
  v_new text := case when p_accept then 'approved' else 'declined' end;
begin
  if v_me is null then raise exception 'Влезте в профила си.' using errcode = '42501'; end if;
  select * into r from public.photo_share_requests where id = p_request for update;
  select * into v_conv from public.conversations where id = r.conversation_id;
  if r.id is null or v_me <> v_conv.client_id then
    raise exception 'Заявката не е намерена.' using errcode = '42501';
  end if;
  if r.status <> 'pending' then raise exception 'Вече е отговорено.'; end if;
  update public.photo_share_requests set status = v_new where id = r.id;
  insert into public.messages (conversation_id, sender_id, body, meta)
  values (v_conv.id, v_me,
          case when p_accept then 'Съгласен съм да покажеш снимката в профила си.' else 'Предпочитам снимката да не се показва.' end,
          jsonb_build_object('share_request', r.id, 'event', v_new));
  return v_new;
end;
$$;

-- The craftsman marks an approved photo as added to his portfolio
create or replace function public.mark_photo_share_published(p_request uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.photo_share_requests set published_at = now()
  where id = p_request and requested_by = auth.uid() and status = 'approved' and published_at is null;
  if not found then raise exception 'Снимката не е одобрена от клиента.' using errcode = '42501'; end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Retention: the nightly cleanup also queues the files of purged conversations; the worker deletes them
-- (files can only be removed through the Storage API, not with SQL).
-- ---------------------------------------------------------------------------
create table public.chat_photo_purge_queue (
  conversation_id uuid primary key,
  created_at timestamptz not null default now()
);
alter table public.chat_photo_purge_queue enable row level security;
revoke all on public.chat_photo_purge_queue from anon, authenticated;

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
  ), queued as (
    insert into public.chat_photo_purge_queue (conversation_id)
    select id from old on conflict do nothing returning conversation_id
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

revoke execute on function
  public.check_message_photos(), public.request_photo_share(bigint, text),
  public.respond_photo_share(uuid, boolean), public.mark_photo_share_published(uuid),
  public.cleanup_old_chats(integer)
  from public, anon, authenticated;
grant execute on function
  public.request_photo_share(bigint, text), public.respond_photo_share(uuid, boolean),
  public.mark_photo_share_published(uuid)
  to authenticated;
