-- ゆず茶の温度選択を画面表記に合わせて「アイス」に統一する。
update options option_row
set name = 'アイス'
from option_groups option_group
join menu_items menu_item on menu_item.id = option_group.menu_item_id
where option_row.group_id = option_group.id
  and option_group.name = '温度'
  and menu_item.name = 'ゆず茶'
  and option_row.name = 'コールド';
