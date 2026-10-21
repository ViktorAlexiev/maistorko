-- 1. Photos on a client's card in the notebook (Pro). A private bucket: only the craftsman who uploaded can read them.
-- 2. For Pro craftsmen: how many search impressions carried the "Препоръчан партньор" mark.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-photos', 'client-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path convention: client-photos/<uploader id>/<client id>/<file>
create policy "client photos: owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'client-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "client photos: owner upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'client-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not public.is_banned()
  );
create policy "client photos: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'client-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create table public.client_photos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.craftsman_clients (id) on delete cascade,
  craftsman_id uuid not null references public.craftsman_profiles (id) on delete cascade,
  path text not null unique check (char_length(path) <= 200),
  caption text check (char_length(caption) <= 140),
  created_at timestamptz not null default now()
);
create index client_photos_idx on public.client_photos (client_id, created_at desc);

alter table public.client_photos enable row level security;
create policy "client photos: manage own" on public.client_photos
  for all to authenticated
  using (public.can_manage_craftsman(craftsman_id)) with check (public.can_manage_craftsman(craftsman_id));
revoke all on public.client_photos from anon, authenticated;
grant select, insert, update, delete on public.client_photos to authenticated;

-- Same rules as notes: the client is his, Pro only, at most 20 photos per client
create or replace function public.check_client_photo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.craftsman_clients c where c.id = new.client_id and c.craftsman_id = new.craftsman_id) then
    raise exception 'Клиентът не е твой.' using errcode = '42501';
  end if;
  if public.is_api_request() and not public.has_feature(new.craftsman_id, 'client_cards') then
    raise exception 'Снимките към клиент са в Pro.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.client_photos p where p.client_id = new.client_id) >= 20 then
    raise exception 'Най-много 20 снимки към един клиент.';
  end if;
  return new;
end;
$$;
create trigger client_photos_check before insert on public.client_photos
  for each row execute function public.check_client_photo();
revoke execute on function public.check_client_photo() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Partner impressions: how often a profile with the boost was shown (with the mark)
-- ---------------------------------------------------------------------------
alter table public.daily_stats add column boosted_impressions integer not null default 0 check (boosted_impressions >= 0);

create or replace function public.record_impressions(p_ids uuid[], p_offset integer default 0)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_pos integer;
  v_day date := (now() at time zone 'Europe/Sofia')::date;
begin
  if p_ids is null or cardinality(p_ids) > 60 then return; end if;
  -- a craftsman listed twice counts once, at his best (first) position
  for v_id, v_pos in
    select x.id, min(x.pos) from unnest(p_ids) with ordinality as x(id, pos) group by x.id
  loop
    if v_id is distinct from auth.uid() and exists (select 1 from public.craftsman_profiles where id = v_id and not is_hidden) then
      insert into public.daily_stats (craftsman_id, day, impressions, exposure, boosted_impressions)
      values (v_id, v_day, 1, round((ln(2.0) / ln((greatest(p_offset, 0) + v_pos + 1)::numeric))::numeric, 4),
              case when public.has_feature(v_id, 'boost') then 1 else 0 end)
      on conflict (craftsman_id, day) do update
        set impressions = public.daily_stats.impressions + 1,
            exposure = public.daily_stats.exposure + excluded.exposure,
            boosted_impressions = public.daily_stats.boosted_impressions + excluded.boosted_impressions;
    end if;
  end loop;
end;
$$;

revoke execute on function public.record_impressions(uuid[], integer) from public, anon, authenticated;
grant execute on function public.record_impressions(uuid[], integer) to anon, authenticated;
