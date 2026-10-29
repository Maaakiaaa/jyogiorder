-- ゆず茶はソーダ割りのみ販売する。温度・水割りの選択肢はUIから非表示にする。
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

  if dilution_group_id is null then
    raise exception 'ゆず茶の割り方グループが見つかりません';
  end if;

  if temperature_group_id is not null then
    update option_groups
    set required = false
    where id = temperature_group_id;

    update options
    set is_available = false,
        is_active = false
    where group_id = temperature_group_id;
  end if;

  update option_groups
  set required = true
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
