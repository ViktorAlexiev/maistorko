-- "Майстор за всичко" goes first among the categories (small everyday repairs are what the site is mostly for).
update public.categories set sort = 5 where slug = 'maistor-za-vsichko' and parent_id is null;
