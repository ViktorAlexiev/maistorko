-- Майсторлъка: the product was renamed from Майсторко. E-mail subjects carry the new name.

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

-- Unsent e-mails already queued under the old name
update public.email_outbox
set subject = replace(subject, 'Майсторко', 'Майсторлъка')
where sent_at is null and subject like '%Майсторко%';
