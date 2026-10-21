-- Reviews only come from clients who talked to the craftsman on the site.
-- The review-by-link feature for outside work is dropped; instead the craftsman marks the work as done
-- in the chat and the client gets a message with an "Остави отзив" button.

drop function if exists public.create_review_invite(uuid);
drop function if exists public.review_invite_info(uuid);
drop function if exists public.submit_review_by_token(uuid, integer, text);
drop table if exists public.review_invites;

create or replace function public.request_review_in_chat(p_conversation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
  if exists (
    select 1 from public.messages m
    where m.conversation_id = v_conv.id and m.meta ->> 'event' = 'review_request'
      and m.created_at > now() - interval '30 days'
  ) then
    raise exception 'Вече поискахте отзив от този клиент.';
  end if;
  insert into public.messages (conversation_id, sender_id, body, meta)
  values (v_conv.id, v_me, 'Работата е свършена. Ще се радвам на кратък отзив.',
          jsonb_build_object('event', 'review_request'));
end;
$$;

revoke execute on function public.request_review_in_chat(uuid) from public, anon;
grant execute on function public.request_review_in_chat(uuid) to authenticated;
