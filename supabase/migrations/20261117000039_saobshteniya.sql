-- Съобщения: отзив само след свършена работа, кутията в разговора, снимки към
-- първото съобщение (качване в папка без разговор), оферта в чата без „видяна“.
-- Може да се пусне повторно: колоната, политиките и функциите са с if not exists / or replace.

-- ---------------------------------------------------------------------------
-- 1. Поканата за отзив се помни в разговора (съобщението изчезва при чистенето)
-- ---------------------------------------------------------------------------
alter table public.conversations add column if not exists review_requested_at timestamptz;

update public.conversations c set review_requested_at = m.at
from (
  select conversation_id, max(created_at) as at
  from public.messages
  where meta ->> 'event' = 'review_request'
  group by conversation_id
) m
where m.conversation_id = c.id and c.review_requested_at is null;

-- ---------------------------------------------------------------------------
-- 2. Кога е свършена работата и кой може да даде отзив
-- ---------------------------------------------------------------------------
create or replace function public.work_done_on(p_conversation uuid) returns date
language sql stable security definer set search_path = '' as $$
  select max(d) from (
    select (c.review_requested_at at time zone 'Europe/Sofia')::date as d
    from public.conversations c
    where c.id = p_conversation
    union all
    select coalesce(b.end_date, b.booking_date)
    from public.bookings b
    where b.conversation_id = p_conversation
      and b.status = 'confirmed'
      and coalesce(b.end_date, b.booking_date) < public.sofia_now()::date
    union all
    select (j.done_at at time zone 'Europe/Sofia')::date
    from public.jobs j
    where j.conversation_id = p_conversation and j.status = 'done' and j.done_at is not null
  ) x
$$;
revoke execute on function public.work_done_on(uuid) from public, anon, authenticated;

create or replace function public.can_review(p_craftsman uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
     and auth.uid() <> p_craftsman
     and not public.is_banned()
     and exists (
       select 1 from public.conversations c
       where c.client_id = auth.uid() and c.craftsman_id = p_craftsman
         and public.work_done_on(c.id) is not null
     )
$$;

create or replace function public.review_box(p_conversation uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_conv public.conversations;
  v_upcoming boolean;
  v_done date;
  v_updated timestamptz;
begin
  if v_me is null or public.is_banned() then return null; end if;
  select * into v_conv from public.conversations where id = p_conversation;
  if v_conv.id is null or v_conv.craftsman_id is null then return null; end if;

  select exists (
    select 1 from public.bookings b
    where b.conversation_id = v_conv.id
      and ((b.status = 'confirmed' and coalesce(b.end_date, b.booking_date) >= public.sofia_now()::date)
        or (b.status = 'proposed' and b.booking_date >= public.sofia_now()::date))
  ) into v_upcoming;

  if v_me = v_conv.craftsman_id then
    if exists (select 1 from public.messages m where m.conversation_id = v_conv.id)
       and not v_upcoming
       and (v_conv.review_requested_at is null or v_conv.review_requested_at <= now() - interval '30 days') then
      return 'ask';
    end if;
    return null;
  end if;

  if v_me = v_conv.client_id then
    if v_upcoming or v_conv.review_requested_at is not null then return null; end if;
    v_done := public.work_done_on(v_conv.id);
    if v_done is null then return null; end if;
    select r.updated_at into v_updated
    from public.reviews r
    where r.client_id = v_me and r.craftsman_id = v_conv.craftsman_id;
    if not found then return 'rate'; end if;
    if (v_updated at time zone 'Europe/Sofia')::date < v_done then return 'update'; end if;
    return null;
  end if;

  return null;
end;
$$;
revoke execute on function public.review_box(uuid) from public, anon;
grant execute on function public.review_box(uuid) to authenticated;

create or replace function public.request_review_in_chat(p_conversation uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_conv public.conversations;
begin
  if v_me is null then raise exception 'Влезте в профила си.' using errcode = '42501'; end if;
  if public.is_banned() then raise exception 'Профилът ви е блокиран.' using errcode = '42501'; end if;
  select * into v_conv from public.conversations where id = p_conversation;
  if v_conv.id is null or v_conv.craftsman_id is distinct from v_me then
    raise exception 'Разговорът не е намерен.' using errcode = '42501';
  end if;
  if v_conv.review_requested_at is not null and v_conv.review_requested_at > now() - interval '30 days' then
    raise exception 'Вече поискахте отзив от този клиент.';
  end if;
  insert into public.messages (conversation_id, sender_id, body, meta)
  values (v_conv.id, v_me, 'Работата е свършена. Ще се радвам на кратък отзив.',
          jsonb_build_object('event', 'review_request'));
  update public.conversations set review_requested_at = now() where id = v_conv.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Първо съобщение със снимки: id на бъдещия разговор и снимки
-- ---------------------------------------------------------------------------
drop function if exists public.start_conversation(uuid, text, date, smallint, text, uuid);

create or replace function public.start_conversation(
  p_craftsman uuid, p_body text, p_date date default null, p_category smallint default null,
  p_slot text default null, p_service uuid default null, p_id uuid default null, p_photos text[] default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_conv uuid;
  v_meta jsonb := '{}';
  v_service public.services;
  v_category smallint := p_category;
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

  if p_photos is not null and cardinality(p_photos) > 0 then
    if p_id is null then raise exception 'Невалидна снимка.'; end if;
    if exists (select 1 from public.conversations c where c.client_id = v_me and c.craftsman_id = p_craftsman) then
      raise exception 'Разговорът вече е започнат. Презаредете страницата.';
    end if;
  end if;

  if p_service is not null then
    select * into v_service from public.services where id = p_service and craftsman_id = p_craftsman;
    if v_service.id is null then raise exception 'Услугата не е намерена.'; end if;
    v_category := coalesce(v_service.category_id, v_category);
  end if;

  insert into public.conversations (id, client_id, craftsman_id, requested_date, category_id)
  values (coalesce(p_id, gen_random_uuid()), v_me, p_craftsman, p_date, v_category)
  on conflict (client_id, craftsman_id) do update
    set requested_date = coalesce(excluded.requested_date, public.conversations.requested_date),
        category_id = coalesce(excluded.category_id, public.conversations.category_id)
  returning id into v_conv;

  -- only a call that created the conversation clears the queue (on a conflict the existing id comes back)
  if p_id is not null and v_conv = p_id then
    delete from public.chat_photo_purge_queue where conversation_id = v_conv;
  end if;

  if p_date is not null then v_meta := v_meta || jsonb_build_object('date', p_date); end if;
  if p_date is not null and p_slot is not null then v_meta := v_meta || jsonb_build_object('slot', p_slot); end if;
  if v_service.id is not null then
    v_meta := v_meta || jsonb_build_object('service', v_service.name, 'price_kind', v_service.price_kind,
                                           'price', v_service.price, 'unit', v_service.unit);
  elsif v_category is not null then
    v_meta := v_meta || jsonb_build_object('category', (select name from public.categories where id = v_category));
  end if;
  if p_photos is not null and cardinality(p_photos) > 0 then
    v_meta := v_meta || jsonb_build_object('photos', (select jsonb_agg(jsonb_build_object('path', x)) from unnest(p_photos) as x));
  end if;

  insert into public.messages (conversation_id, sender_id, body, meta)
  values (v_conv, v_me, btrim(p_body), v_meta);
  return v_conv;
end;
$$;
revoke all on function public.start_conversation(uuid, text, date, smallint, text, uuid, uuid, text[]) from public, anon;
grant execute on function public.start_conversation(uuid, text, date, smallint, text, uuid, uuid, text[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Качване на снимки в папка без разговор (до 4 в папка, до 8 общо)
-- ---------------------------------------------------------------------------
create or replace function public.is_unclaimed_chat_folder(p_folder text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_folder ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and not exists (select 1 from public.conversations where id = p_folder::uuid)
$$;
revoke execute on function public.is_unclaimed_chat_folder(text) from public, anon;
grant execute on function public.is_unclaimed_chat_folder(text) to authenticated;

create or replace function public.can_upload_unsent_chat_photo(p_folder text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_unclaimed_chat_folder(p_folder)
     and (select count(*) from storage.objects o
          where o.bucket_id = 'chat-photos' and o.owner_id = auth.uid()::text
            and (storage.foldername(o.name))[1] = p_folder) < 4
     and (select count(*) from storage.objects o
          where o.bucket_id = 'chat-photos' and o.owner_id = auth.uid()::text
            and public.is_unclaimed_chat_folder((storage.foldername(o.name))[1])) < 8
$$;
revoke execute on function public.can_upload_unsent_chat_photo(text) from public, anon;
grant execute on function public.can_upload_unsent_chat_photo(text) to authenticated;

drop policy if exists "chat photos: participants upload" on storage.objects;
create policy "chat photos: participants upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-photos'
    and (public.is_conversation_member((storage.foldername(name))[1])
         or public.can_upload_unsent_chat_photo((storage.foldername(name))[1]))
    and not public.is_banned()
  );

drop policy if exists "chat photos: uploader reads unsent" on storage.objects;
create policy "chat photos: uploader reads unsent" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-photos'
    and owner_id = (select auth.uid())::text
    and public.is_unclaimed_chat_folder((storage.foldername(name))[1])
  );

-- ---------------------------------------------------------------------------
-- 5. Чистене: неизпратените снимки в папки без разговор
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_orphan_chat_photos(p_age interval default interval '1 day')
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_n integer;
begin
  insert into public.chat_photo_purge_queue (conversation_id)
  select (storage.foldername(o.name))[1]::uuid
  from storage.objects o
  where o.bucket_id = 'chat-photos'
    and (storage.foldername(o.name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and not exists (select 1 from public.conversations c where c.id = (storage.foldername(o.name))[1]::uuid)
  group by 1
  having min(o.created_at) < now() - p_age
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke execute on function public.enqueue_orphan_chat_photos(interval) from public, anon, authenticated;

create or replace function public.cleanup_old_chats(p_days integer default 60) returns integer
language plpgsql security definer set search_path = '' as $$
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

  perform public.enqueue_orphan_chat_photos();

  delete from public.notifications where read_at is not null and read_at < now() - interval '90 days';
  delete from public.email_outbox where sent_at is not null and sent_at < now() - interval '30 days';
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Офертите в разговора, без да се отбелязва „видяна“
-- ---------------------------------------------------------------------------
create or replace function public.chat_offers(p_conversation uuid)
returns table (token uuid, lines jsonb, total numeric, status text, valid_until timestamptz, viewed_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select o.token, o.lines, o.total,
         case when o.status = 'sent' and o.valid_until < now() then 'expired' else o.status end,
         o.valid_until, o.viewed_at
  from public.offers o
  where public.is_conv_party(p_conversation)
    and o.token in (
      select (m.meta ->> 'offer')::uuid
      from public.messages m
      where m.conversation_id = p_conversation
        and (m.meta ->> 'offer') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    )
$$;
revoke execute on function public.chat_offers(uuid) from public, anon;
grant execute on function public.chat_offers(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Редактиран отзив: оценката или текстът са променени след първото публикуване
-- ---------------------------------------------------------------------------
alter table public.reviews add column if not exists edited_at timestamptz;

create or replace function public.set_review_edited_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.edited_at := null;
  else
    new.edited_at := case
      when new.rating is distinct from old.rating or new.body is distinct from old.body then now()
      else old.edited_at
    end;
  end if;
  return new;
end;
$$;
revoke execute on function public.set_review_edited_at() from public, anon, authenticated;
drop trigger if exists reviews_edited_at on public.reviews;
create trigger reviews_edited_at before insert or update on public.reviews
  for each row execute function public.set_review_edited_at();

drop function public.craftsman_reviews(uuid, int);
create function public.craftsman_reviews(p_craftsman uuid, p_limit integer default 20)
returns table(id uuid, rating smallint, body text, created_at timestamptz, author text, is_mine boolean, edited_at timestamptz)
language sql
stable security definer
set search_path to ''
as $function$
  select r.id, r.rating, r.body, r.created_at,
         coalesce(nullif(split_part(btrim(p.full_name), ' ', 1), ''), 'Клиент')
           || case when split_part(btrim(p.full_name), ' ', 2) <> ''
                   then ' ' || left(split_part(btrim(p.full_name), ' ', 2), 1) || '.' else '' end,
         r.client_id = auth.uid(),
         r.edited_at
  from public.reviews r
  join public.profiles p on p.id = r.client_id
  where r.craftsman_id = p_craftsman and not r.is_hidden
  order by r.created_at desc
  limit least(greatest(p_limit, 1), 100)
$function$;
revoke execute on function public.craftsman_reviews(uuid, int) from public;
grant execute on function public.craftsman_reviews(uuid, int) to anon, authenticated;
