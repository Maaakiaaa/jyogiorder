-- 焼き鳥セットにドリンクスロットが存在しない環境を修復する。
do $$
declare
  drink_category_id bigint;
  yakitori_item_id bigint;
  set_menu_item_id bigint;
  duplicate_set_item_id bigint;
begin
  select id into drink_category_id
  from categories
  where name = 'ドリンク'
  order by id
  limit 1;

  select id into yakitori_item_id
  from menu_items
  where name = '焼き鳥'
  order by id
  limit 1;

  select id into set_menu_item_id
  from menu_items
  where name in ('焼き鳥セット', 'ドリンクと焼き鳥セット')
  order by id
  limit 1;

  if drink_category_id is null or yakitori_item_id is null or set_menu_item_id is null then
    raise exception 'ドリンクと焼き鳥セット、焼き鳥品目、ドリンクカテゴリのいずれかが見つかりません';
  end if;

  update menu_items
  set name = 'ドリンクと焼き鳥セット', is_set = true
  where id = set_menu_item_id;

  -- 同じセットが複数作られている場合は、採用した1件以外を削除する。
  -- order_items.menu_item_id は on delete set null、表示用スナップショットは保持される。
  for duplicate_set_item_id in
    select id
    from menu_items
    where id <> set_menu_item_id
      and name in ('焼き鳥セット', 'ドリンクと焼き鳥セット')
  loop
    delete from bundle_slots where set_item_id = duplicate_set_item_id;
    delete from menu_items where id = duplicate_set_item_id;
  end loop;

  insert into bundle_slots (set_item_id, name, kind, fixed_item_id, display_order)
  values (set_menu_item_id, '焼き鳥', 'fixed', yakitori_item_id, 1)
  on conflict (set_item_id, name) do update
    set kind = excluded.kind,
        fixed_item_id = excluded.fixed_item_id,
        source_category_id = null,
        display_order = excluded.display_order;

  insert into bundle_slots (set_item_id, name, kind, source_category_id, display_order)
  values (set_menu_item_id, 'ドリンク', 'category', drink_category_id, 2)
  on conflict (set_item_id, name) do update
    set kind = excluded.kind,
        fixed_item_id = null,
        source_category_id = excluded.source_category_id,
        display_order = excluded.display_order;
end $$;
