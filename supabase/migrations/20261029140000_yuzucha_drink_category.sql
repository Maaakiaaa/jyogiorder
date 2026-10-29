-- 管理画面から追加したゆず茶2品がカテゴリ未設定(null)のため、お客さん画面で焼き鳥タブに出ていた。
-- ドリンクカテゴリへ移す。ドリンクと焼き鳥セットのドリンク枠(ドリンクカテゴリから選ぶ)にも並ぶようになる。
do $$
declare
  drink_category_id bigint;
  moved_count integer;
begin
  select id into drink_category_id
  from categories
  where name = 'ドリンク'
  order by id
  limit 1;

  if drink_category_id is null then
    raise exception 'ドリンクカテゴリが見つかりません';
  end if;

  update menu_items
  set category_id = drink_category_id
  where name in ('ゆず茶（HOT）', 'ゆず茶ソーダ');

  get diagnostics moved_count = row_count;
  if moved_count = 0 then
    raise exception 'ゆず茶（HOT）/ゆず茶ソーダのmenu_items行が見つかりません';
  end if;
end $$;
