-- ゆず茶はホット、またはアイス（ゆずソーダ）のみ販売する。
do $$
declare
  yuzu_menu_item_id bigint;
  dilution_group_id bigint;
begin
  select id into yuzu_menu_item_id
  from menu_items
  where name = 'ゆず茶'
  order by id
  limit 1;

  if yuzu_menu_item_id is null then
    raise exception 'ゆず茶のmenu_items行が見つかりません';
  end if;

  select id into dilution_group_id
  from option_groups
  where menu_item_id = yuzu_menu_item_id
    and name = '割り方'
  order by id
  limit 1;

  if dilution_group_id is not null then
    update options
    set is_available = false,
        is_active = false
    where group_id = dilution_group_id
      and name = '水割り';
  end if;
end $$;
