-- Майсторко: Row Level Security on every table, storage buckets, realtime.

alter table public.cities enable row level security;
alter table public.categories enable row level security;
alter table public.search_synonyms enable row level security;
alter table public.profiles enable row level security;
alter table public.craftsman_profiles enable row level security;
alter table public.craftsman_service_areas enable row level security;
alter table public.craftsman_categories enable row level security;
alter table public.services enable row level security;
alter table public.work_photos enable row level security;
alter table public.availability_rules enable row level security;
alter table public.availability_exceptions enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;
alter table public.saved_craftsmen enable row level security;

-- Is this craftsman publicly listed? (not hidden, owner not banned)
create or replace function public.craftsman_is_public(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.craftsman_profiles c
    join public.profiles p on p.id = c.id
    where c.id = p_id and not c.is_hidden and not p.is_banned
  )
$$;
grant execute on function public.craftsman_is_public(uuid) to anon, authenticated;

-- Owner of a craftsman profile, still allowed to write (not banned)
create or replace function public.owns_craftsman(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() = p_id and not public.is_banned()
     and exists (select 1 from public.craftsman_profiles c where c.id = p_id)
$$;
grant execute on function public.owns_craftsman(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Reference data: public read, admin write
-- ---------------------------------------------------------------------------
create policy "cities: public read" on public.cities
  for select to anon, authenticated using (true);
create policy "cities: admin write" on public.cities
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "categories: public read active" on public.categories
  for select to anon, authenticated using (is_active or public.is_admin());
create policy "categories: admin insert" on public.categories
  for insert to authenticated with check (public.is_admin());
create policy "categories: admin update" on public.categories
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "categories: admin delete" on public.categories
  for delete to authenticated using (public.is_admin());

create policy "synonyms: public read" on public.search_synonyms
  for select to anon, authenticated using (true);
create policy "synonyms: admin write" on public.search_synonyms
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Profiles: private. Only the owner and admins. (Public craftsman data lives
-- in craftsman_profiles; chat partner names come from my_conversations().)
-- ---------------------------------------------------------------------------
create policy "profiles: owner read" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles: owner update" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
-- inserts happen only through the auth trigger; deletes cascade from auth.users

-- ---------------------------------------------------------------------------
-- Craftsman profiles: public read when listed; owner/admin write
-- ---------------------------------------------------------------------------
create policy "craftsmen: public read listed" on public.craftsman_profiles
  for select to anon, authenticated
  using (public.craftsman_is_public(id) or id = auth.uid() or public.is_admin());
create policy "craftsmen: owner update" on public.craftsman_profiles
  for update to authenticated
  using ((id = auth.uid() and not public.is_banned()) or public.is_admin())
  with check ((id = auth.uid() and not public.is_banned()) or public.is_admin());
create policy "craftsmen: admin delete" on public.craftsman_profiles
  for delete to authenticated using (public.is_admin());

-- Child tables of a craftsman: same pattern
create policy "service areas: public read" on public.craftsman_service_areas
  for select to anon, authenticated
  using (public.craftsman_is_public(craftsman_id) or craftsman_id = auth.uid() or public.is_admin());
create policy "service areas: owner write" on public.craftsman_service_areas
  for all to authenticated
  using (public.owns_craftsman(craftsman_id)) with check (public.owns_craftsman(craftsman_id));

create policy "craftsman categories: public read" on public.craftsman_categories
  for select to anon, authenticated
  using (public.craftsman_is_public(craftsman_id) or craftsman_id = auth.uid() or public.is_admin());
create policy "craftsman categories: owner write" on public.craftsman_categories
  for all to authenticated
  using (public.owns_craftsman(craftsman_id)) with check (public.owns_craftsman(craftsman_id));

create policy "services: public read" on public.services
  for select to anon, authenticated
  using (public.craftsman_is_public(craftsman_id) or craftsman_id = auth.uid() or public.is_admin());
create policy "services: owner write" on public.services
  for all to authenticated
  using (public.owns_craftsman(craftsman_id)) with check (public.owns_craftsman(craftsman_id));

create policy "work photos: public read" on public.work_photos
  for select to anon, authenticated
  using (public.craftsman_is_public(craftsman_id) or craftsman_id = auth.uid() or public.is_admin());
create policy "work photos: owner write" on public.work_photos
  for all to authenticated
  using (public.owns_craftsman(craftsman_id)) with check (public.owns_craftsman(craftsman_id));
create policy "work photos: admin delete" on public.work_photos
  for delete to authenticated using (public.is_admin());

create policy "availability rules: public read" on public.availability_rules
  for select to anon, authenticated
  using (public.craftsman_is_public(craftsman_id) or craftsman_id = auth.uid() or public.is_admin());
create policy "availability rules: owner write" on public.availability_rules
  for all to authenticated
  using (public.owns_craftsman(craftsman_id)) with check (public.owns_craftsman(craftsman_id));

-- Exceptions are public (they drive the visible calendar) but notes are the
-- craftsman's own; the public calendar is rendered via availability_days().
create policy "availability exceptions: public read" on public.availability_exceptions
  for select to anon, authenticated
  using (public.craftsman_is_public(craftsman_id) or craftsman_id = auth.uid() or public.is_admin());
create policy "availability exceptions: owner write" on public.availability_exceptions
  for all to authenticated
  using (public.owns_craftsman(craftsman_id)) with check (public.owns_craftsman(craftsman_id));

-- ---------------------------------------------------------------------------
-- Conversations & messages: only the two participants. Not even admins.
-- Writes go through start_conversation() / mark_conversation_read().
-- ---------------------------------------------------------------------------
create policy "conversations: participants read" on public.conversations
  for select to authenticated
  using (auth.uid() in (client_id, craftsman_id));

create policy "messages: participants read" on public.messages
  for select to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and auth.uid() in (c.client_id, c.craftsman_id)
  ));
create policy "messages: participants send" on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and not public.is_banned()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and auth.uid() in (c.client_id, c.craftsman_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Reviews: public read (visible ones); only eligible clients write their own
-- ---------------------------------------------------------------------------
create policy "reviews: public read" on public.reviews
  for select to anon, authenticated
  using (not is_hidden or client_id = auth.uid() or public.is_admin());
create policy "reviews: eligible client insert" on public.reviews
  for insert to authenticated
  with check (client_id = auth.uid() and public.can_review(craftsman_id));
create policy "reviews: author update" on public.reviews
  for update to authenticated
  using (client_id = auth.uid() or public.is_admin())
  with check (client_id = auth.uid() or public.is_admin());
create policy "reviews: author or admin delete" on public.reviews
  for delete to authenticated
  using (client_id = auth.uid() or public.is_admin());

-- Only admins may hide reviews
create or replace function public.protect_review_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_api_request() and not public.is_admin() then
    if new.is_hidden is distinct from old.is_hidden
       or new.client_id is distinct from old.client_id
       or new.craftsman_id is distinct from old.craftsman_id then
      raise exception 'Нямате права за тази промяна.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger reviews_protect before update on public.reviews
  for each row execute function public.protect_review_columns();

-- ---------------------------------------------------------------------------
-- Saved craftsmen: owner only
-- ---------------------------------------------------------------------------
create policy "saved: owner all" on public.saved_craftsmen
  for all to authenticated
  using (client_id = auth.uid()) with check (client_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Table privileges (RLS still applies on top)
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant select on public.cities, public.categories, public.search_synonyms,
  public.craftsman_profiles, public.craftsman_service_areas, public.craftsman_categories,
  public.services, public.work_photos, public.availability_rules,
  public.availability_exceptions, public.reviews
to anon;

-- Authenticated users never write derived/aggregate columns directly
revoke insert, delete on public.profiles from authenticated;
revoke insert on public.craftsman_profiles from authenticated;
revoke insert, update, delete on public.conversations from authenticated;
revoke update, delete on public.messages from authenticated;

-- ---------------------------------------------------------------------------
-- Storage: avatars (2 MB) and work photos (5 MB); public read, owner write.
-- Path convention: <bucket>/<user id>/<file>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('work-photos', 'work-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "storage: public read images" on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('avatars', 'work-photos'));

create policy "storage: owner upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('avatars', 'work-photos')
    and (storage.foldername(name))[1] = auth.uid()::text
    and not public.is_banned()
  );

create policy "storage: owner update" on storage.objects
  for update to authenticated
  using (bucket_id in ('avatars', 'work-photos') and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id in ('avatars', 'work-photos') and (storage.foldername(name))[1] = auth.uid()::text);

create policy "storage: owner or admin delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('avatars', 'work-photos')
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- ---------------------------------------------------------------------------
-- Realtime: chat messages and conversation summaries (RLS-filtered)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
