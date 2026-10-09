-- A manager can confirm the calendar of a craftsman in his company (same rule as editing it).

drop function public.confirm_calendar();

create or replace function public.confirm_calendar(p_craftsman uuid default null)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_target uuid := coalesce(p_craftsman, auth.uid());
begin
  if v_target is distinct from auth.uid() and not public.can_manage_craftsman(v_target) then
    raise exception 'Нямате право да потвърдите този график.' using errcode = '42501';
  end if;
  update public.craftsman_profiles set last_confirmed_at = v_now where id = v_target;
  if not found then raise exception 'Нямате профил на майстор.'; end if;
  return v_now;
end;
$$;

revoke execute on function public.confirm_calendar(uuid) from public, anon, authenticated;
grant execute on function public.confirm_calendar(uuid) to authenticated;
