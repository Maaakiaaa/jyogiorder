-- ゆず茶のセット選択肢。既存のドリンク品目は複製せず、ドリンクカテゴリへ登録して参照する。
do $$
declare
  drink_category_id bigint;
  yuzu_menu_item_id bigint;
  temperature_group_id bigint;
  dilution_group_id bigint;
  next_menu_code integer;
  next_option_code integer;
begin
  select id into drink_category_id
  from categories
  where name = 'ドリンク'
  order by id
  limit 1;

  if drink_category_id is null then
    raise exception 'ドリンクカテゴリが見つかりません。先に20261017120000_yakitori_drink_set.sqlを適用してください';
  end if;

  select id into yuzu_menu_item_id
  from menu_items
  where name = 'ゆず茶'
  order by id
  limit 1;

  if yuzu_menu_item_id is null then
    select coalesce(max(code), 0) + 1 into next_menu_code from menu_items;
    insert into menu_items (category_id, name, price, code, is_set)
    values (drink_category_id, 'ゆず茶', 200, next_menu_code, false)
    returning id into yuzu_menu_item_id;
  else
    update menu_items
    set category_id = drink_category_id,
        is_active = true
    where id = yuzu_menu_item_id;
  end if;

  select id into temperature_group_id
  from option_groups
  where menu_item_id = yuzu_menu_item_id and name = '温度'
  order by id
  limit 1;

  if temperature_group_id is null then
    insert into option_groups (menu_item_id, name, required, display_order)
    values (yuzu_menu_item_id, '温度', true, 1)
    returning id into temperature_group_id;
  end if;

  select id into dilution_group_id
  from option_groups
  where menu_item_id = yuzu_menu_item_id and name = '割り方'
  order by id
  limit 1;

  if dilution_group_id is null then
    insert into option_groups (menu_item_id, name, required, display_order)
    values (yuzu_menu_item_id, '割り方', false, 2)
    returning id into dilution_group_id;
  end if;

  select coalesce(max(code), 0) + 1 into next_option_code from options;

  if not exists (select 1 from options where group_id = temperature_group_id and name = 'ホット') then
    insert into options (group_id, name, price_delta, code, is_available, is_active, display_order)
    values (temperature_group_id, 'ホット', 0, next_option_code, true, true, 1);
    next_option_code := next_option_code + 1;
  end if;

  if not exists (select 1 from options where group_id = temperature_group_id and name = 'アイス') then
    insert into options (group_id, name, price_delta, code, is_available, is_active, display_order)
    values (temperature_group_id, 'アイス', 0, next_option_code, true, true, 2);
    next_option_code := next_option_code + 1;
  end if;

  if not exists (select 1 from options where group_id = dilution_group_id and name = '水割り') then
    insert into options (group_id, name, price_delta, code, is_available, is_active, display_order)
    values (dilution_group_id, '水割り', 0, next_option_code, true, true, 1);
    next_option_code := next_option_code + 1;
  end if;

  if not exists (select 1 from options where group_id = dilution_group_id and name = 'ソーダ割り') then
    insert into options (group_id, name, price_delta, code, is_available, is_active, display_order)
    values (dilution_group_id, 'ソーダ割り', 0, next_option_code, true, true, 2);
  end if;
end $$;
