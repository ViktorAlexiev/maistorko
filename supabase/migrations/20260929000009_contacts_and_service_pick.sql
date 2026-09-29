-- 1. Who can see a craftsman's phone number (replaces phone_after_chat):
--    public – anyone, after pressing "Покажи телефона"
--    login  – any signed-in user
--    chat   – the client, after the craftsman has replied in their chat
--    hidden – nobody; contact only through the chat
-- 2. The first message can name a priced service: the name and price go into the message meta.

alter table public.craftsman_profiles
  add column phone_visibility text not null default 'login'
    check (phone_visibility in ('public', 'login', 'chat', 'hidden'));

update public.craftsman_profiles set phone_visibility = case when phone_after_chat then 'chat' else 'hidden' end;

-- The phone for the current viewer, or null. Never exposes it when the rules above don't allow it.
create or replace function public.craftsman_phone(p_craftsman uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.phone
  from public.craftsman_profiles c
  join public.profiles p on p.id = c.id
  where c.id = p_craftsman
    and p.phone is not null
    and (
      c.id = auth.uid()
      or (public.craftsman_is_listed(c.id) and (
        c.phone_visibility = 'public'
        or (c.phone_visibility = 'login' and auth.uid() is not null)
        or (c.phone_visibility = 'chat' and exists (
          select 1 from public.conversations cv
          join public.messages m on m.conversation_id = cv.id and m.sender_id = cv.craftsman_id
          where cv.craftsman_id = c.id and cv.client_id = auth.uid()
        ))
      ))
    )
$$;

-- What the public profile may say about the phone without revealing it.
create or replace function public.craftsman_contact_info(p_craftsman uuid)
returns table (has_phone boolean, visibility text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.phone is not null, c.phone_visibility
  from public.craftsman_profiles c
  join public.profiles p on p.id = c.id
  where c.id = p_craftsman
$$;

create or replace function public.conversation_partner_phone(p_conversation uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select public.craftsman_phone(c.craftsman_id)
  from public.conversations c
  where c.id = p_conversation and c.client_id = auth.uid()
$$;

alter table public.craftsman_profiles drop column phone_after_chat;

grant execute on function public.craftsman_phone(uuid) to anon, authenticated;
grant execute on function public.craftsman_contact_info(uuid) to anon, authenticated;

-- start_conversation: optional service
drop function public.start_conversation(uuid, text, date, smallint, text);

create function public.start_conversation(
  p_craftsman uuid,
  p_body text,
  p_date date default null,
  p_category smallint default null,
  p_slot text default null,
  p_service uuid default null
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

  if p_service is not null then
    select * into v_service from public.services where id = p_service and craftsman_id = p_craftsman;
    if v_service.id is null then raise exception 'Услугата не е намерена.'; end if;
    v_category := coalesce(v_service.category_id, v_category);
  end if;

  insert into public.conversations (client_id, craftsman_id, requested_date, category_id)
  values (v_me, p_craftsman, p_date, v_category)
  on conflict (client_id, craftsman_id) do update
    set requested_date = coalesce(excluded.requested_date, public.conversations.requested_date),
        category_id = coalesce(excluded.category_id, public.conversations.category_id)
  returning id into v_conv;

  if p_date is not null then v_meta := v_meta || jsonb_build_object('date', p_date); end if;
  if p_date is not null and p_slot is not null then v_meta := v_meta || jsonb_build_object('slot', p_slot); end if;
  if v_service.id is not null then
    v_meta := v_meta || jsonb_build_object('service', v_service.name, 'price_kind', v_service.price_kind,
                                           'price', v_service.price, 'unit', v_service.unit);
  elsif v_category is not null then
    v_meta := v_meta || jsonb_build_object('category', (select name from public.categories where id = v_category));
  end if;

  insert into public.messages (conversation_id, sender_id, body, meta)
  values (v_conv, v_me, btrim(p_body), v_meta);
  return v_conv;
end;
$$;

revoke execute on function public.start_conversation(uuid, text, date, smallint, text, uuid) from anon, public;
grant execute on function public.start_conversation(uuid, text, date, smallint, text, uuid) to authenticated;
