-- セットの「カテゴリから選ぶ」枠(ドリンクと焼き鳥セットのドリンク枠など)に出してよい品目かどうか。
-- スープはドリンクカテゴリ(ドリンクタブに表示)だが、セットで選ばれると損をするため枠からは外す。
alter table menu_items
  add column if not exists bundle_selectable boolean not null default true;

update menu_items
set bundle_selectable = false
where name = 'スープ';
