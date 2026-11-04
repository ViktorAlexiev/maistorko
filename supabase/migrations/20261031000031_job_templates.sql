-- Ready-made typical small jobs per category. A craftsman ticks the ones he does and writes a price (he does not
-- start from an empty page). The templates also feed the estimates:
--   - the usual price range of a job in the craftsman's city ("колегите вземат 30–50 €", shown to Pro craftsmen
--     when adding a job, and as "ориентировъчно" to clients),
--   - an estimated price from the hourly rate x typical time, for jobs the craftsman left "по оглед".

create table public.job_templates (
  id smallint generated always as identity primary key,
  category_slug text not null,
  name text not null unique check (char_length(name) between 2 and 120),
  unit public.price_unit not null default 'job',
  -- hours of work for one unit (one job, or one m²): used only for the estimate
  typical_hours numeric(4,2) not null check (typical_hours > 0 and typical_hours <= 60),
  sort smallint not null default 100
);
create index job_templates_category_idx on public.job_templates (category_slug, sort);

alter table public.job_templates enable row level security;
create policy "job templates: public read" on public.job_templates for select to anon, authenticated using (true);
create policy "job templates: admin write" on public.job_templates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.job_templates from anon, authenticated;
grant select on public.job_templates to anon, authenticated;
grant insert, update, delete on public.job_templates to authenticated;

alter table public.services add column template_id smallint references public.job_templates (id) on delete set null;
create index services_template_idx on public.services (template_id) where template_id is not null;

insert into public.job_templates (category_slug, name, unit, typical_hours, sort) values
  -- Майстор за всичко
  ('maistor-za-vsichko', 'Закачане на ТВ на стена', 'job', 1.0, 1),
  ('maistor-za-vsichko', 'Закачане на лавица или картина', 'job', 0.5, 2),
  ('maistor-za-vsichko', 'Сглобяване на мебел', 'job', 2.0, 3),
  ('maistor-za-vsichko', 'Смяна на брава', 'job', 1.0, 4),
  ('maistor-za-vsichko', 'Регулиране на врата', 'job', 0.5, 5),
  ('maistor-za-vsichko', 'Монтаж на корниз за завеси', 'job', 1.0, 6),
  ('maistor-za-vsichko', 'Поправка на течащ кран', 'job', 1.0, 7),
  ('maistor-za-vsichko', 'Дребна поправка (на час)', 'hour', 1.0, 8),
  -- ВиК
  ('vik', 'Отпушване на мивка', 'job', 1.0, 1),
  ('vik', 'Смяна на батерия', 'job', 1.0, 2),
  ('vik', 'Смяна на сифон', 'job', 1.0, 3),
  ('vik', 'Смяна на казанче', 'job', 2.0, 4),
  ('vik', 'Течаща тръба', 'job', 1.5, 5),
  ('vik', 'Монтаж на мивка', 'job', 2.0, 6),
  ('vik', 'Монтаж на бойлер', 'job', 2.5, 7),
  ('vik', 'Свързване на пералня', 'job', 1.0, 8),
  -- Електро
  ('elektro', 'Смяна на контакт или ключ', 'job', 0.5, 1),
  ('elektro', 'Монтаж на лампа или полилей', 'job', 1.0, 2),
  ('elektro', 'Смяна на бушон', 'job', 0.5, 3),
  ('elektro', 'Поставяне на нов контакт', 'job', 1.5, 4),
  ('elektro', 'Монтаж на ел. табло', 'job', 4.0, 5),
  ('elektro', 'Търсене на повреда', 'job', 2.0, 6),
  ('elektro', 'Монтаж на вентилатор', 'job', 1.5, 7),
  -- Климатици и отопление
  ('klimatitsi-otoplenie', 'Монтаж на климатик', 'job', 4.0, 1),
  ('klimatitsi-otoplenie', 'Профилактика на климатик', 'job', 1.5, 2),
  ('klimatitsi-otoplenie', 'Зареждане на климатик с фреон', 'job', 1.5, 3),
  ('klimatitsi-otoplenie', 'Демонтаж на климатик', 'job', 1.5, 4),
  ('klimatitsi-otoplenie', 'Ремонт на климатик', 'job', 2.0, 5),
  -- Боя и шпакловка
  ('boyadisvane-shpaklovka', 'Боядисване на стени', 'm2', 0.25, 1),
  ('boyadisvane-shpaklovka', 'Шпакловка', 'm2', 0.4, 2),
  ('boyadisvane-shpaklovka', 'Боядисване на таван', 'm2', 0.3, 3),
  ('boyadisvane-shpaklovka', 'Боядисване на стая', 'job', 8.0, 4);

-- ---------------------------------------------------------------------------
-- The usual price range of each job, from what craftsmen really wrote (needs at least 5 prices).
-- First the craftsman's own city, then the whole country. Anyone can read it; it only shows the range.
-- ---------------------------------------------------------------------------
create or replace function public.template_price_ranges(p_templates smallint[], p_city text default null)
returns table (template_id smallint, scope text, p25 numeric, p75 numeric, n integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_city smallint;
  v_t smallint;
  v_scope text;
begin
  if p_templates is null or cardinality(p_templates) > 60 then return; end if;
  select c.id into v_city from public.cities c where c.slug = p_city;

  foreach v_t in array p_templates loop
    foreach v_scope in array array['city', 'all'] loop
      if v_scope = 'city' and v_city is null then continue; end if;
      return query
      with prices as (
        select s.price v
        from public.services s
        join public.craftsman_profiles cp on cp.id = s.craftsman_id and not cp.is_hidden
        where s.template_id = v_t and s.price is not null and s.price_kind in ('fixed', 'from')
          and (v_scope = 'all' or cp.city_id = v_city)
      )
      select v_t, v_scope,
             round((select percentile_cont(0.25) within group (order by v) from prices)::numeric, 0),
             round((select percentile_cont(0.75) within group (order by v) from prices)::numeric, 0),
             (select count(*)::integer from prices)
      where (select count(*) from prices) >= 5;
      if found then exit; end if;
    end loop;
  end loop;
end;
$$;

revoke execute on function public.template_price_ranges(smallint[], text) from public;
grant execute on function public.template_price_ranges(smallint[], text) to anon, authenticated;
