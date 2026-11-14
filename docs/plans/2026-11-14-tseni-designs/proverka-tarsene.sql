-- Proposed rule v2, per craftsman returned by the search:
--  1) service: full-text match on all words (build_search_query, strict) OR word_similarity(q, name) >= 0.6;
--     full-text before trigram-only, then today's tie rule: unit = job first, lowest price; quote last
--  2) else box: a checked subcategory whose name+keywords+parent name match all words, or word_similarity(q, name) >= 0.6
--     (box price simulated as the old hourly_rate, which the migration copies into empty boxes)
--  3) else the general lead price (today's price_from)
with q(txt) as (
  values ('отпушване на тръба'), ('смяна на контакт'), ('боядисване'), ('климатик'),
         ('смесител'), ('телевизор на стена'), ('плочки баня'), ('ток'), ('вик'), ('ремонт'),
         ('монтаж на климатик'), ('боядисване на стая'), ('ламинат'), ('сглобяване на гардероб'),
         ('отпушване'), ('теч'), ('лампа'), ('бойлер')
),
hits as (
  select q.txt, r.id, r.display_name, r.price_from, r.price_from_unit, false as loose
  from q cross join lateral public.search_craftsmen(p_q => q.txt, p_limit => 48) r
  union all
  select q.txt, r.id, r.display_name, r.price_from, r.price_from_unit, true
  from q cross join lateral public.search_craftsmen(p_q => q.txt, p_limit => 48, p_any => true) r
  where not exists (select 1 from public.search_craftsmen(p_q => q.txt, p_limit => 1) x)
),
svc as (
  select h.txt, h.id, s.name, s.price_kind, s.price, s.unit,
         to_tsvector('simple', lower(concat_ws(' ', s.name, s.description))) @@ public.build_search_query(h.txt, false) as ft,
         extensions.word_similarity(lower(h.txt), lower(s.name)) as ws
  from hits h join public.services s on s.craftsman_id = h.id
),
svc_best as (
  select distinct on (txt, id) * from svc
  where ft or ws >= 0.6
  order by txt, id, ft desc, (price_kind = 'quote'), (unit = 'job') desc, price asc nulls last
),
box as (
  select h.txt, h.id, cat.name,
         to_tsvector('simple', lower(concat_ws(' ', cat.name, array_to_string(cat.keywords, ' '), par.name)))
           @@ public.build_search_query(h.txt, false) as ft,
         extensions.word_similarity(lower(h.txt), lower(cat.name)) as ws,
         cp.hourly_rate
  from hits h
  join public.craftsman_categories cc on cc.craftsman_id = h.id
  join public.categories cat on cat.id = cc.category_id
  left join public.categories par on par.id = cat.parent_id
  join public.craftsman_profiles cp on cp.id = h.id
),
box_best as (
  select distinct on (txt, id) * from box
  where ft or ws >= 0.6
  order by txt, id, ft desc, ws desc
)
select h.txt, h.display_name,
       coalesce(h.price_from::text, '-') || '/' || coalesce(h.price_from_unit::text, '') as today,
       case
         when s.name is not null then 'УСЛУГА ' || s.name || ' = ' || s.price_kind || ' ' || coalesce(s.price::text, '') || '/' || s.unit
                                      || case when s.ft then ' [ft]' else ' [tri ' || round(s.ws::numeric, 2) || ']' end
         when b.name is not null then 'КУТИЯ ' || b.name || ' = ' || coalesce(b.hourly_rate::text || '/hour', '(празна)')
                                      || case when b.ft then ' [ft]' else ' [tri ' || round(b.ws::numeric, 2) || ']' end
         else 'ОБЩА ' || coalesce(h.price_from::text, '-') || '/' || coalesce(h.price_from_unit::text, '')
       end as shown
from hits h
left join svc_best s on s.txt = h.txt and s.id = h.id
left join box_best b on b.txt = h.txt and b.id = h.id
order by h.txt, h.display_name;
