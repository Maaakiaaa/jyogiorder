-- 客側の注文確定待ち画面がordersのINSERT通知を受け取れるようにする。
-- 既に有効化済みの環境にも安全に適用できるよう、登録済みか確認してから追加する。
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table orders;
  end if;
end $$;

-- orders_select は匿名利用の注文確認に必要な既存ポリシー。
-- 注文IDをクエリ条件に指定した行取得をanonへ許可する。
drop policy if exists "orders_select" on orders;
create policy "orders_select" on orders for select to anon, authenticated using (true);