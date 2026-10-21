-- Quick replies: ready-made answers the craftsman taps in the chat. Free for everyone.
-- The first ones ("Идвам утре в 10", ...) come with the app; this table holds the craftsman's own.

create table public.quick_replies (
  id uuid primary key default gen_random_uuid(),
  craftsman_id uuid not null references public.craftsman_profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 300),
  created_at timestamptz not null default now()
);
create index quick_replies_idx on public.quick_replies (craftsman_id, created_at);

alter table public.quick_replies enable row level security;
create policy "quick replies: owner" on public.quick_replies
  for all to authenticated
  using (public.owns_craftsman(craftsman_id)) with check (public.owns_craftsman(craftsman_id));
revoke all on public.quick_replies from anon, authenticated;
grant select, insert, delete on public.quick_replies to authenticated;

-- At most 20 own replies per craftsman
create or replace function public.limit_quick_replies()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.quick_replies q where q.craftsman_id = new.craftsman_id) >= 20 then
    raise exception 'Най-много 20 свои бързи отговора. Изтрий някой, за да добавиш нов.';
  end if;
  return new;
end;
$$;
create trigger quick_replies_limit before insert on public.quick_replies
  for each row execute function public.limit_quick_replies();
