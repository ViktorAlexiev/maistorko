-- Fix of migration 32: that one was copied from an older propose_booking and dropped the company-conversation
-- support (assigned craftsman). This is the current version from migration 20 with only one change: a booking made
-- in the chat is always a proposal, the other side has to agree before the day is taken in the calendar.

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
          'proposed',
          nullif(btrim(coalesce(p_note, '')), ''), v_me,
          null)
  returning * into v_b;

  if v_by_craftsman and public.booking_overlaps(v_b) then
    raise exception 'Вече имате потвърдена уговорка или поръчка в този период.';
  end if;

  insert into public.messages (conversation_id, sender_id, body, meta)
  values (v_conv.id, v_me,
          'Предлагам ' || public.booking_label(v_b),
          jsonb_build_object('booking_id', v_b.id, 'event', 'proposed'));
  return v_b.id;
end;
$$;
