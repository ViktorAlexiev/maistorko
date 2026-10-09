-- Personal link / QR code: counts visits that arrive through /m/<slug>, per day and source.
-- Counters only. No visitor data is stored.

create table public.link_visits (
  craftsman_id uuid not null references public.craftsman_profiles (id) on delete cascade,
  day date not null default ((now() at time zone 'Europe/Sofia')::date),
  source text not null check (source in ('link', 'qr')),
  visits integer not null default 0 check (visits >= 0),
  primary key (craftsman_id, day, source)
);

alter table public.link_visits enable row level security;

create policy "owner reads own link visits" on public.link_visits
  for select to authenticated using (craftsman_id = (select auth.uid()));

revoke all on public.link_visits from anon, authenticated;
grant select on public.link_visits to authenticated;

create or replace function public.record_link_visit(p_slug text, p_source text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_source not in ('link', 'qr') then return; end if;
  select c.id into v_id
  from public.craftsman_profiles c
  where c.slug = p_slug and not c.is_hidden;
  if v_id is null then return; end if;

  insert into public.link_visits (craftsman_id, day, source, visits)
  values (v_id, (now() at time zone 'Europe/Sofia')::date, p_source, 1)
  on conflict (craftsman_id, day, source) do update set visits = public.link_visits.visits + 1;
end;
$$;

revoke execute on function public.record_link_visit(text, text) from public;
grant execute on function public.record_link_visit(text, text) to anon, authenticated;
