-- Price hints (Pro): "colleagues in your city charge 40–70 € for this kind of work".
-- Shown only with enough data (at least 5 prices): first for the craftsman's own city, then for the whole country.

create or replace function public.category_price_hint(p_category smallint)
returns table (
  scope text,
  hourly_p25 numeric, hourly_p75 numeric, hourly_count int,
  job_p25 numeric, job_p75 numeric, job_count int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_city smallint;
  v_scope text;
begin
  if auth.uid() is null or not public.has_feature(auth.uid(), 'price_hints') then return; end if;
  select cp.city_id into v_city from public.craftsman_profiles cp where cp.id = auth.uid();

  foreach v_scope in array array['city', 'all'] loop
    return query
    with cats as (
      select id from public.categories where id = p_category or parent_id = p_category
    ),
    crafts as (
      select distinct cc.craftsman_id from public.craftsman_categories cc
      join public.craftsman_profiles cp on cp.id = cc.craftsman_id and not cp.is_hidden
      where cc.category_id in (select id from cats)
        and cc.craftsman_id <> auth.uid()
        and (v_scope = 'all' or cp.city_id = v_city)
    ),
    hourly as (
      select cp.hourly_rate v from public.craftsman_profiles cp
      where cp.id in (select craftsman_id from crafts) and cp.hourly_rate is not null
    ),
    jobs as (
      select s.price v from public.services s
      where s.craftsman_id in (select craftsman_id from crafts)
        and s.unit = 'job' and s.price is not null
        and (s.category_id is null or s.category_id in (select id from cats))
    ),
    n as (select (select count(*) from hourly) as h, (select count(*) from jobs) as j)
    select v_scope,
      case when n.h >= 5 then round((select percentile_cont(0.25) within group (order by v) from hourly)::numeric, 0) end,
      case when n.h >= 5 then round((select percentile_cont(0.75) within group (order by v) from hourly)::numeric, 0) end,
      n.h::int,
      case when n.j >= 5 then round((select percentile_cont(0.25) within group (order by v) from jobs)::numeric, 0) end,
      case when n.j >= 5 then round((select percentile_cont(0.75) within group (order by v) from jobs)::numeric, 0) end,
      n.j::int
    from n
    where n.h >= 5 or n.j >= 5;
    if found then return; end if;
  end loop;
end;
$$;

revoke execute on function public.category_price_hint(smallint) from public, anon;
grant execute on function public.category_price_hint(smallint) to authenticated;
