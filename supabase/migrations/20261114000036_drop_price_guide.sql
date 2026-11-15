-- The old price guide read craftsman_profiles.hourly_rate, which is gone; nothing calls it any more.
drop function public.category_price_guide(smallint);
