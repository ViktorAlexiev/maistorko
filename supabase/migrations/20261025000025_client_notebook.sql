-- "Тетрадката ти с клиенти": a light CRM for the craftsman (Pro, the same plan feature as client cards).
-- Statuses, a call reminder, a yearly-check switch and a log of notes per client.

alter table public.craftsman_clients
  add column status text not null default 'new'
    check (status in ('new', 'inspection', 'offer', 'agreed', 'done')),
  add column remind_at date,
  add column remind_note text check (char_length(remind_note) <= 200),
  add column yearly_check boolean not null default false;

create index craftsman_clients_remind_idx on public.craftsman_clients (craftsman_id, remind_at)
  where remind_at is not null;

create table public.client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.craftsman_clients (id) on delete cascade,
  craftsman_id uuid not null references public.craftsman_profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index client_notes_idx on public.client_notes (client_id, created_at desc);

alter table public.client_notes enable row level security;
create policy "client notes: manage own" on public.client_notes
  for all to authenticated
  using (public.can_manage_craftsman(craftsman_id)) with check (public.can_manage_craftsman(craftsman_id));
revoke all on public.client_notes from anon, authenticated;
grant select, insert, delete on public.client_notes to authenticated;

-- The note belongs to the same craftsman as the client, and writing notes is Pro like client cards
create or replace function public.check_client_note()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.craftsman_clients c where c.id = new.client_id and c.craftsman_id = new.craftsman_id) then
    raise exception 'Клиентът не е твой.' using errcode = '42501';
  end if;
  if public.is_api_request() and not public.has_feature(new.craftsman_id, 'client_cards') then
    raise exception 'Бележките към клиент са в Pro.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger client_notes_check before insert on public.client_notes
  for each row execute function public.check_client_note();

-- A finished job for a client who gets a yearly check: remind in a year, and the client is "done"
create or replace function public.on_job_done_remind()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.client_id is not null and new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    update public.craftsman_clients c set
      status = 'done',
      remind_at = case when c.yearly_check then (new.end_date + interval '1 year')::date else c.remind_at end,
      remind_note = case when c.yearly_check then 'Годишен преглед' else c.remind_note end
    where c.id = new.client_id;
  end if;
  return null;
end;
$$;
create trigger jobs_done_remind after insert or update of status on public.jobs
  for each row execute function public.on_job_done_remind();

revoke execute on function public.check_client_note(), public.on_job_done_remind()
  from public, anon, authenticated;
