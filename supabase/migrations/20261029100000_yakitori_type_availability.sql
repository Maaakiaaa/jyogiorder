-- 焼き鳥は商品単位ではなく、種類(もも・ねぎま・かわ等)ごとに売り切れを管理する。
alter table yakitori_types
  add column if not exists is_available boolean not null default true;

update menu_items
set is_yakitori_set = true,
    yakitori_skewer_count = 1
where name = '焼き鳥'
  and is_set = false
  and is_yakitori_set = false;

create or replace function public.set_yakitori_type_available(p_type_id bigint, p_is_available boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff_or_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.yakitori_types
  set is_available = p_is_available
  where id = p_type_id;
  if not found then raise exception 'yakitori type not found' using errcode = 'P0002'; end if;
end;
$$;

revoke all on function public.set_yakitori_type_available(bigint, boolean) from public, anon;
grant execute on function public.set_yakitori_type_available(bigint, boolean) to authenticated;
