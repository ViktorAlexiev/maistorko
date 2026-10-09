-- Abuse controls: reports ("Докладвай"), rate limits, duplicate-message detection, admin audit log.
-- Limits apply to signed-in users acting through the API (auth.uid() is set). Seed and admin
-- scripts run without a user and are exempt, like the other protection triggers.

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null, -- null = flagged automatically
  target_type text not null check (target_type in ('profile', 'conversation', 'review')),
  target_id uuid not null,
  -- the person the report is about (for grouping): the profile itself, the other party, the review's author
  target_user uuid references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('spam', 'scam', 'offensive', 'fake', 'other')),
  details text check (char_length(details) <= 1000),
  status text not null default 'new' check (status in ('new', 'done', 'dismissed')),
  handled_by uuid references public.profiles (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at desc);
create index reports_target_idx on public.reports (target_user, status);

alter table public.reports enable row level security;
create policy "admins read reports" on public.reports for select to authenticated using (public.is_admin());
create policy "admins update reports" on public.reports for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.reports from anon, authenticated;
grant select on public.reports to authenticated;
grant update (status, handled_by, handled_at) on public.reports to authenticated;

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
    select case when v_me = c.client_id then c.craftsman_id else c.client_id end into v_user
    from public.conversations c where c.id = p_target and v_me in (c.client_id, c.craftsman_id);
  elsif p_type = 'review' then
    select r.client_id into v_user from public.reviews r where r.id = p_target;
  else
    raise exception 'Невалиден вид доклад.';
  end if;
  if v_user is null then raise exception 'Не е намерено.'; end if;
  if v_user = v_me then raise exception 'Не можете да докладвате себе си.'; end if;

  if exists (select 1 from public.reports where reporter_id = v_me and target_type = p_type and target_id = p_target and status = 'new') then
    return; -- already reported and waiting: same answer, no duplicate
  end if;
  if (select count(*) from public.reports where reporter_id = v_me and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Днес изпратихте много доклади. Опитайте утре.';
  end if;

  insert into public.reports (reporter_id, target_type, target_id, target_user, reason, details)
  values (v_me, p_type, p_target, v_user, p_reason, nullif(btrim(coalesce(p_details, '')), ''));
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin audit log
-- ---------------------------------------------------------------------------
create table public.admin_log (
  id bigint generated always as identity primary key,
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null check (char_length(action) <= 80),
  target_type text check (char_length(target_type) <= 40),
  target_id text check (char_length(target_id) <= 80),
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index admin_log_idx on public.admin_log (created_at desc);
alter table public.admin_log enable row level security;
create policy "admins read log" on public.admin_log for select to authenticated using (public.is_admin());
revoke all on public.admin_log from anon, authenticated;
grant select on public.admin_log to authenticated;

create or replace function public.log_admin_action(p_action text, p_target_type text default null, p_target_id text default null, p_details jsonb default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Нямате администраторски права.' using errcode = '42501';
  end if;
  insert into public.admin_log (admin_id, action, target_type, target_id, details)
  values (auth.uid(), left(p_action, 80), left(p_target_type, 40), left(p_target_id, 80), coalesce(p_details, '{}'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- Rate limits and duplicate detection
-- ---------------------------------------------------------------------------
create or replace function public.limit_messages()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dupes integer;
  v_links integer;
begin
  -- only for the signed-in sender acting for himself (RPCs run as the definer, so auth.uid() is used)
  if auth.uid() is null or auth.uid() <> new.sender_id then return new; end if;
  -- booking events written by the system are not "messages" for these rules
  if new.meta ? 'booking_id' then return new; end if;

  if (select count(*) from public.messages m where m.sender_id = new.sender_id and m.created_at > now() - interval '1 minute') >= 20 then
    raise exception 'Твърде много съобщения за кратко време. Опитайте след минута.' using errcode = 'P0001';
  end if;

  v_links := (select count(*) from regexp_matches(new.body, 'https?://|www\.', 'gi'));
  if v_links >= 3 then
    raise exception 'Съобщението съдържа твърде много линкове.' using errcode = 'P0001';
  end if;

  -- the same text to many different conversations in an hour is spam (a client asking a few
  -- craftsmen the same question is normal, so the threshold is high)
  if char_length(new.body) >= 15 then
    select count(distinct m.conversation_id) into v_dupes from public.messages m
    where m.sender_id = new.sender_id and m.body = new.body and m.created_at > now() - interval '1 hour'
      and m.conversation_id <> new.conversation_id;
    -- from the 6th conversation on: flag the sender for the admins. The flag has to be written before the
    -- refusal below, because raising an exception rolls back everything this trigger inserted.
    if v_dupes >= 6 and not exists (select 1 from public.reports where reporter_id is null and target_user = new.sender_id
                                    and status = 'new' and created_at > now() - interval '1 day') then
      insert into public.reports (reporter_id, target_type, target_id, target_user, reason, details)
      values (null, 'profile', new.sender_id, new.sender_id, 'spam', 'Автоматично: еднакво съобщение до много разговори.');
    end if;
    if v_dupes >= 8 then
      raise exception 'Не можете да пращате едно и също съобщение на много хора.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
create trigger messages_limits before insert on public.messages
  for each row execute function public.limit_messages();

create or replace function public.limit_conversations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or auth.uid() <> new.client_id then return new; end if;
  if (select count(*) from public.conversations c where c.client_id = new.client_id and c.created_at > now() - interval '1 day') >= 30 then
    raise exception 'Днес започнахте много разговори. Опитайте утре.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger conversations_limits before insert on public.conversations
  for each row execute function public.limit_conversations();

create or replace function public.limit_reviews()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or auth.uid() <> new.client_id then return new; end if;
  if (select count(*) from public.reviews r where r.client_id = new.client_id and r.created_at > now() - interval '1 day') >= 3 then
    raise exception 'Днес оставихте много отзиви. Опитайте утре.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger reviews_limits before insert on public.reviews
  for each row execute function public.limit_reviews();

revoke execute on function
  public.report_content(text, uuid, text, text), public.log_admin_action(text, text, text, jsonb),
  public.limit_messages(), public.limit_conversations(), public.limit_reviews()
  from public, anon, authenticated;
grant execute on function public.report_content(text, uuid, text, text), public.log_admin_action(text, text, text, jsonb)
  to authenticated;
