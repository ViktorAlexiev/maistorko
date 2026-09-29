-- Free-text description for craftsmen who pick "Други услуги".
-- It is searchable (same weight as categories) and shown on the public profile.

alter table public.craftsman_profiles
  add column other_services text check (char_length(other_services) <= 200);

create or replace function public.refresh_craftsman_search(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_head text;
  v_cats text;
  v_other text;
  v_services text;
  v_bio text;
begin
  select lower(concat_ws(' ', c.display_name, c.business_name, ci.name)), lower(c.bio), lower(c.other_services)
    into v_head, v_bio, v_other
  from public.craftsman_profiles c
  left join public.cities ci on ci.id = c.city_id
  where c.id = p_id;

  if v_head is null then return; end if;

  select lower(string_agg(concat_ws(' ', cat.name, parent.name, array_to_string(cat.keywords, ' '),
                                    array_to_string(parent.keywords, ' ')), ' '))
    into v_cats
  from public.craftsman_categories cc
  join public.categories cat on cat.id = cc.category_id
  left join public.categories parent on parent.id = cat.parent_id
  where cc.craftsman_id = p_id;

  v_cats := concat_ws(' ', v_cats, v_other);

  select lower(string_agg(concat_ws(' ', s.name, s.description), ' '))
    into v_services
  from public.services s where s.craftsman_id = p_id;

  update public.craftsman_profiles set
    search_text = left(concat_ws(' ', v_head, v_cats, v_services, v_bio), 6000),
    search_vector =
      setweight(to_tsvector('simple', coalesce(v_head, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(v_cats, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(v_services, '')), 'B') ||
      setweight(to_tsvector('simple', coalesce(v_bio, '')), 'C')
  where id = p_id;
end;
$$;

drop trigger craftsman_derived_upd on public.craftsman_profiles;
create trigger craftsman_derived_upd
  after update of display_name, business_name, bio, city_id, hourly_rate, other_services on public.craftsman_profiles
  for each row execute function public.trg_craftsman_derived();
