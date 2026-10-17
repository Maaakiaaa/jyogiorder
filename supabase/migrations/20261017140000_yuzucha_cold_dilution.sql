-- ゆず茶の割り方はコールド時だけ必要。
update option_groups
set required = false
where name = '割り方'
  and menu_item_id in (
    select id from menu_items where name = 'ゆず茶'
  );
