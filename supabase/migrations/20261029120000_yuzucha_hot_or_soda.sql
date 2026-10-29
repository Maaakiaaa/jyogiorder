-- ゆず茶はホット、またはアイス(ゆずソーダ)を選べる。
-- アイスを選んだ場合のみ、割り方はソーダ割りに固定する。
do $$
declare
  yuzu_menu_item_id bigint;
  temperature_group_id bigint;
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

  select id into temperature_group_id
  from option_groups
  where menu_item_id = yuzu_menu_item_id and name = '温度'
  order by id
  limit 1;

  select id into dilution_group_id
  from option_groups
  where menu_item_id = yuzu_menu_item_id and name = '割り方'
  order by id
  limit 1;

  if temperature_group_id is null or dilution_group_id is null then
    raise exception 'ゆず茶の温度または割り方グループが見つかりません';
  end if;

  update option_groups
  set required = true
  where id = temperature_group_id;

  update options
  set is_available = true,
      is_active = true
  where group_id = temperature_group_id
    and name in ('ホット', 'アイス');

  update option_groups
  set required = false
  where id = dilution_group_id;

  update options
  set is_available = false,
      is_active = false
  where group_id = dilution_group_id
    and name <> 'ソーダ割り';

  update options
  set is_available = true,
      is_active = true
  where group_id = dilution_group_id
    and name = 'ソーダ割り';
end $$;
