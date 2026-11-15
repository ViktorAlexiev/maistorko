-- Цени по категории („кутии“): една цена на майстор и подкатегория (точна, „от“, на час или „по оглед“).
-- Старата цена на час (craftsman_profiles.hourly_rate) е пренесена в кутии на час и колоната я няма.
-- Водещата цена, видимостта в търсенето и ценовата подсказка за Pro гледат кутиите.
-- Всяка готова работа (job_templates) е вързана за подкатегория.

-- ---------------------------------------------------------------------------
-- 1. Таблицата, проверките, тригерът за подкатегория, RLS
-- ---------------------------------------------------------------------------
create table public.category_prices (
  craftsman_id uuid not null references public.craftsman_profiles (id) on delete cascade,
  category_id smallint not null references public.categories (id),
  kind text not null check (kind in ('fixed', 'from', 'hour', 'quote')),
  price numeric(8,2) check (price is null or (price > 0 and price <= 100000)),
  unit public.price_unit not null,
  updated_at timestamptz not null default now(),
  primary key (craftsman_id, category_id),
  check ((kind = 'quote') = (price is null)),
  check ((kind = 'hour') = (unit = 'hour')),
  check (kind <> 'quote' or unit = 'job')
);

create or replace function public.trg_category_price_leaf()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.categories c where c.id = new.category_id and c.parent_id is not null) then
    raise exception 'Цена се слага само на подкатегория.';
  end if;
  return new;
end;
$$;
create trigger category_prices_leaf before insert or update on public.category_prices
  for each row execute function public.trg_category_price_leaf();

alter table public.category_prices enable row level security;
create policy "category prices: public read" on public.category_prices
  for select to anon, authenticated
  using (public.craftsman_is_public(craftsman_id) or craftsman_id = auth.uid() or public.is_admin());
create policy "category prices: owner write" on public.category_prices
  for all to authenticated
  using (public.owns_craftsman(craftsman_id)) with check (public.owns_craftsman(craftsman_id));

revoke all on public.category_prices from anon, authenticated;
grant select on public.category_prices to anon, authenticated;
grant insert, update, delete on public.category_prices to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Готовите работи по подкатегории
-- ---------------------------------------------------------------------------
alter table public.job_templates add column category_id smallint references public.categories (id);

update public.job_templates jt
set category_id = sub.id
from (values
  ('Закачане на ТВ на стена', 'Монтаж и окачване'),
  ('Закачане на лавица или картина', 'Монтаж и окачване'),
  ('Сглобяване на мебел', 'Монтаж и окачване'),
  ('Смяна на брава', 'Дребни ремонти'),
  ('Регулиране на врата', 'Дребни ремонти'),
  ('Монтаж на корниз за завеси', 'Монтаж и окачване'),
  ('Поправка на течащ кран', 'Дребни ремонти'),
  ('Дребна поправка (на час)', 'Дребни ремонти'),
  ('Отпушване на мивка', 'Канализация и отпушване'),
  ('Смяна на батерия', 'Санитария и смесители'),
  ('Смяна на сифон', 'Канализация и отпушване'),
  ('Смяна на казанче', 'Санитария и смесители'),
  ('Течаща тръба', 'Течове'),
  ('Монтаж на мивка', 'Санитария и смесители'),
  ('Монтаж на бойлер', 'Бойлери'),
  ('Свързване на пералня', 'Водопровод'),
  ('Смяна на контакт или ключ', 'Контакти и ключове'),
  ('Монтаж на лампа или полилей', 'Осветление'),
  ('Смяна на бушон', 'Ел. табла'),
  ('Поставяне на нов контакт', 'Контакти и ключове'),
  ('Монтаж на ел. табло', 'Ел. табла'),
  ('Търсене на повреда', 'Аварийни ел. ремонти'),
  ('Монтаж на вентилатор', 'Ел. инсталации'),
  ('Монтаж на климатик', 'Монтаж на климатици'),
  ('Профилактика на климатик', 'Профилактика на климатици'),
  ('Зареждане на климатик с фреон', 'Профилактика на климатици'),
  ('Демонтаж на климатик', 'Монтаж на климатици'),
  ('Ремонт на климатик', 'Профилактика на климатици'),
  ('Боядисване на стени', 'Боядисване'),
  ('Шпакловка', 'Шпакловка'),
  ('Боядисване на таван', 'Боядисване'),
  ('Боядисване на стая', 'Боядисване')
) as m (job_name, sub_name)
join public.categories top on true
join public.categories sub on sub.parent_id = top.id and sub.name = m.sub_name
where jt.name = m.job_name and top.slug = jt.category_slug;

-- Ако някоя работа остане без подкатегория, миграцията пада.
alter table public.job_templates alter column category_id set not null;

-- ---------------------------------------------------------------------------
-- 3. Пренасяне: цената на час става кутия на час във всяка отметната подкатегория
-- ---------------------------------------------------------------------------
insert into public.category_prices (craftsman_id, category_id, kind, price, unit)
select cc.craftsman_id, cc.category_id, 'hour', cp.hourly_rate, 'hour'
from public.craftsman_categories cc
join public.categories c on c.id = cc.category_id and c.parent_id is not null
join public.craftsman_profiles cp on cp.id = cc.craftsman_id
where cp.hourly_rate is not null;

-- ---------------------------------------------------------------------------
-- 4. Тригерът на профила вече не зависи от hourly_rate
-- ---------------------------------------------------------------------------
drop trigger craftsman_derived_upd on public.craftsman_profiles;
create trigger craftsman_derived_upd
  after update of display_name, business_name, bio, city_id, other_services on public.craftsman_profiles
  for each row execute function public.trg_craftsman_derived();

-- ---------------------------------------------------------------------------
-- 5. Функциите гледат кутиите
-- ---------------------------------------------------------------------------
-- Водеща цена: най-ниската сред кутиите (fixed, from, hour) и услугите (fixed, from) с цена,
-- всички на отметнати подкатегории; първо тези „за работа“.
create or replace function public.refresh_craftsman_price(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_price numeric;
  v_unit public.price_unit;
begin
  select x.price, x.unit into v_price, v_unit from (
    select b.price, b.unit from public.category_prices b
    join public.craftsman_categories cc on cc.craftsman_id = b.craftsman_id and cc.category_id = b.category_id
    where b.craftsman_id = p_id and b.kind in ('fixed', 'from', 'hour')
    union all
    select s.price, s.unit from public.services s
    join public.craftsman_categories cc on cc.craftsman_id = s.craftsman_id and cc.category_id = s.category_id
    where s.craftsman_id = p_id and s.price_kind in ('fixed', 'from') and s.price is not null
  ) x
  order by (x.unit = 'job') desc, x.price asc
  limit 1;
  update public.craftsman_profiles
    set price_from = v_price, price_from_unit = v_unit
  where id = p_id;
end;
$$;

create or replace function public.trg_child_refresh()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := coalesce(new.craftsman_id, old.craftsman_id);
begin
  if tg_op = 'UPDATE' and old.craftsman_id <> new.craftsman_id then
    perform public.refresh_craftsman_search(old.craftsman_id);
    perform public.refresh_craftsman_price(old.craftsman_id);
  end if;
  if tg_table_name in ('services', 'craftsman_categories') then
    perform public.refresh_craftsman_search(v_id);
  end if;
  perform public.refresh_craftsman_price(v_id);
  return null;
end;
$$;

create trigger category_prices_refresh after insert or update or delete on public.category_prices
  for each row execute function public.trg_child_refresh();

create or replace function public.craftsman_is_listed(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.craftsman_profiles c
    join public.profiles p on p.id = c.id
    where c.id = p_id
      and not c.is_hidden
      and not p.is_banned
      and char_length(btrim(c.display_name)) >= 2
      and (c.price_from is not null or c.quote_on_inspection
           or exists (select 1 from public.category_prices b
                      join public.craftsman_categories cc on cc.craftsman_id = b.craftsman_id and cc.category_id = b.category_id
                      where b.craftsman_id = c.id and b.kind = 'quote'))
      and exists (select 1 from public.craftsman_categories cc where cc.craftsman_id = c.id)
      and exists (select 1 from public.availability_rules ar where ar.craftsman_id = c.id)
  )
$$;

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
      select min(b.price) v from public.category_prices b
      join public.craftsman_categories cc on cc.craftsman_id = b.craftsman_id and cc.category_id = b.category_id
      where b.kind = 'hour'
        and b.craftsman_id in (select craftsman_id from crafts)
        and b.category_id in (select id from cats)
      group by b.craftsman_id
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

-- ---------------------------------------------------------------------------
-- 6. Колоната hourly_rate изчезва
-- ---------------------------------------------------------------------------
alter table public.craftsman_profiles drop column hourly_rate;

-- ---------------------------------------------------------------------------
-- 7. Водещата цена се смята наново за всички майстори
-- ---------------------------------------------------------------------------
select public.refresh_craftsman_price(id) from public.craftsman_profiles;
