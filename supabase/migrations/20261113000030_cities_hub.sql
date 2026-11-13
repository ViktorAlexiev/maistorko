-- Every city belongs to the group around one of the five big cities ("Къде работя" in the dashboard profile).
alter table public.cities add column hub text;

update public.cities set hub = case
  when slug in ('sofia','bankya','novi-iskar','bozhurishte','kostinbrod','elin-pelin','samokov','pernik') then 'sofia'
  when slug in ('plovdiv','asenovgrad','stamboliyski','rakovski','kuklen','karlovo','parvomay') then 'plovdiv'
  when slug in ('varna','devnya','aksakovo','beloslav','provadiya','byala-varna','balchik') then 'varna'
  when slug in ('burgas','nesebar','pomorie','sozopol','aytos','kameno','primorsko') then 'burgas'
  when slug in ('ruse','byala-ruse','marten','dve-mogili','vetovo','slivo-pole') then 'ruse'
end;

alter table public.cities
  alter column hub set not null,
  add constraint cities_hub_check check (hub in ('sofia','plovdiv','varna','burgas','ruse'));
