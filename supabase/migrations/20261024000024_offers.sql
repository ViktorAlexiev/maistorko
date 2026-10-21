-- Offer by link (Pro): the craftsman picks work, sum and materials and gets a link; the client opens it
-- without an account and accepts with one tap. It is a shared price and deadline, not an invoice.

update public.plans set features = features || '{offers,price_hints,boost}'::text[]
where key = 'pro' and not ('offers' = any (features));
update public.plans set features = features || '{offers,price_hints}'::text[]
where key = 'company' and not ('offers' = any (features));

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  craftsman_id uuid not null references public.craftsman_profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  note text check (char_length(note) <= 1000),
  client_name text check (char_length(client_name) <= 120),
  -- [{"name": "...", "amount": 120.5, "kind": "service" | "material"}]
  lines jsonb not null default '[]',
  total numeric(10,2) not null default 0,
  start_date date,
  end_date date,
  valid_until timestamptz not null default now() + interval '14 days',
  status text not null default 'sent' check (status in ('sent', 'accepted', 'declined')),
  accepted_by text check (char_length(accepted_by) <= 120),
  responded_at timestamptz,
  viewed_at timestamptz,
  job_id uuid references public.jobs (id) on delete set null,
  created_at timestamptz not null default now(),
  check (end_date is null or start_date is not null),
  check (end_date is null or end_date >= start_date)
);
create index offers_craftsman_idx on public.offers (craftsman_id, created_at desc);

alter table public.offers enable row level security;
create policy "offers: owner" on public.offers
  for all to authenticated
  using (public.owns_craftsman(craftsman_id)) with check (public.owns_craftsman(craftsman_id));
revoke all on public.offers from anon, authenticated;
grant select, insert, delete on public.offers to authenticated;

-- Pro only; the lines are checked and the total is always computed here, never taken from the client
create or replace function public.prepare_offer()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_line jsonb;
  v_sum numeric := 0;
begin
  if public.is_api_request() and not public.has_feature(new.craftsman_id, 'offers') then
    raise exception 'Офертите по линк са в плана Pro.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(new.lines) <> 'array' or jsonb_array_length(new.lines) not between 1 and 30 then
    raise exception 'Добави поне един ред (до 30).';
  end if;
  for v_line in select * from jsonb_array_elements(new.lines) loop
    if jsonb_typeof(v_line) <> 'object'
       or char_length(btrim(coalesce(v_line ->> 'name', ''))) not between 1 and 120
       or coalesce(v_line ->> 'kind', '') not in ('service', 'material')
       or coalesce(v_line ->> 'amount', '') !~ '^[0-9]{1,7}(\.[0-9]{1,2})?$' then
      raise exception 'Всеки ред има име, вид и сума.';
    end if;
    v_sum := v_sum + (v_line ->> 'amount')::numeric;
  end loop;
  new.total := v_sum;
  if new.end_date is not null and new.end_date - new.start_date > 120 then
    raise exception 'Периодът е твърде дълъг.';
  end if;
  return new;
end;
$$;
create trigger offers_prepare before insert on public.offers
  for each row execute function public.prepare_offer();

-- ---------------------------------------------------------------------------
-- The client's side: only the secret link, no account
-- ---------------------------------------------------------------------------
create or replace function public.offer_by_token(p_token uuid)
returns table (
  title text, note text, client_name text, lines jsonb, total numeric,
  start_date date, end_date date, valid_until timestamptz, status text,
  accepted_by text, responded_at timestamptz,
  craftsman_name text, craftsman_slug text, avatar_url text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.offers o set viewed_at = now() where o.token = p_token and o.viewed_at is null;
  return query
  select o.title, o.note, o.client_name, o.lines, o.total, o.start_date, o.end_date, o.valid_until,
         case when o.status = 'sent' and o.valid_until < now() then 'expired' else o.status end,
         o.accepted_by, o.responded_at,
         cp.display_name, cp.slug, cp.avatar_url
  from public.offers o
  join public.craftsman_profiles cp on cp.id = o.craftsman_id
  where o.token = p_token;
end;
$$;

create or replace function public.respond_offer(p_token uuid, p_accept boolean, p_name text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_o public.offers;
  v_job uuid;
  v_name text := nullif(left(btrim(coalesce(p_name, '')), 120), '');
begin
  select * into v_o from public.offers where token = p_token for update;
  if v_o.id is null then raise exception 'Офертата не е намерена.'; end if;
  if v_o.status <> 'sent' then raise exception 'На тази оферта вече е отговорено.'; end if;
  if v_o.valid_until < now() then raise exception 'Офертата е изтекла. Помолете майстора за нова.'; end if;
  if p_accept and v_name is null then raise exception 'Напишете името си, за да приемете.'; end if;

  if p_accept and v_o.start_date is not null then
    insert into public.jobs (craftsman_id, title, source, start_date, end_date, note, labor_price)
    values (v_o.craftsman_id, left(v_o.title, 160), 'other', v_o.start_date, coalesce(v_o.end_date, v_o.start_date),
            left('Приета оферта от ' || v_name, 1000), v_o.total)
    returning id into v_job;
  end if;

  update public.offers set
    status = case when p_accept then 'accepted' else 'declined' end,
    accepted_by = v_name, responded_at = now(), job_id = v_job
  where id = v_o.id;

  perform public.push_notification(
    v_o.craftsman_id, 'system',
    case when p_accept then 'Офертата е приета: ' else 'Офертата е отказана: ' end || left(v_o.title, 100),
    case when p_accept then coalesce(v_name, 'Клиентът') || ' прие офертата.' else 'Клиентът отказа офертата.' end,
    '/tabla/oferti');
end;
$$;

revoke execute on function public.prepare_offer(), public.offer_by_token(uuid), public.respond_offer(uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.offer_by_token(uuid), public.respond_offer(uuid, boolean, text) to anon, authenticated;
