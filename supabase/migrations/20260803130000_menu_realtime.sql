-- お客様画面はmenu_itemsの変更をpostgres_changesで購読しているが、Supabaseは
-- テーブルごとに明示的にRealtimeレプリケーション(publication supabase_realtime)へ
-- 追加しないと変更通知が飛ばない。ordersは既にダッシュボード上で有効化済みだったため
-- 気づかれていなかったが、menu_itemsは未追加のままだった(2026-08-03に発覚)。
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'menu_items'
  ) then
    alter publication supabase_realtime add table menu_items;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'yakitori_flavors'
  ) then
    alter publication supabase_realtime add table yakitori_flavors;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'yakitori_types'
  ) then
    alter publication supabase_realtime add table yakitori_types;
  end if;
end $$;
