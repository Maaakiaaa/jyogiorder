-- Authentication boundary: roles are read only from JWT app_metadata.role.
-- Existing permissive policies are replaced here so this migration also repairs existing projects.

alter table categories add column if not exists is_active boolean not null default true;
alter table option_groups add column if not exists is_active boolean not null default true;
alter table bundle_slots add column if not exists is_active boolean not null default true;

create or replace function public.jwt_role()
returns text
language sql
stable
as $$
  select auth.jwt() -> 'app_metadata' ->> 'role'
$$;

create or replace function public.is_staff_or_admin()
returns boolean
language sql
stable
as $$
  select public.jwt_role() in ('staff', 'admin')
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.jwt_role() = 'admin'
$$;

do $$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array[
    'categories', 'menu_items', 'orders', 'order_items', 'push_subscriptions',
    'yakitori_flavors', 'yakitori_types', 'option_groups', 'options', 'bundle_slots'
  ] loop
    for policy_name in
      select policyname from pg_policies where schemaname = 'public' and tablename = table_name
    loop
      execute format('drop policy if exists %I on public.%I', policy_name, table_name);
    end loop;
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

create policy categories_public_select on categories for select to anon using (is_active = true);
create policy categories_admin_write on categories for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy menu_items_public_select on menu_items for select to anon using (is_active = true);
create policy menu_items_staff_select on menu_items for select to authenticated using (public.is_staff_or_admin());
create policy menu_items_admin_write on menu_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy option_groups_public_select on option_groups for select to anon using (is_active = true);
create policy option_groups_staff_select on option_groups for select to authenticated using (public.is_staff_or_admin());
create policy option_groups_admin_write on option_groups for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy options_public_select on options for select to anon using (is_active = true);
create policy options_staff_select on options for select to authenticated using (public.is_staff_or_admin());
create policy options_admin_write on options for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy bundle_slots_public_select on bundle_slots for select to anon using (is_active = true);
create policy bundle_slots_staff_select on bundle_slots for select to authenticated using (public.is_staff_or_admin());
create policy bundle_slots_admin_write on bundle_slots for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy yakitori_flavors_public_select on yakitori_flavors for select to anon using (is_active = true);
create policy yakitori_flavors_staff_select on yakitori_flavors for select to authenticated using (public.is_staff_or_admin());
create policy yakitori_flavors_admin_write on yakitori_flavors for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy yakitori_types_public_select on yakitori_types for select to anon using (is_active = true);
create policy yakitori_types_staff_select on yakitori_types for select to authenticated using (public.is_staff_or_admin());
create policy yakitori_types_admin_write on yakitori_types for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy orders_staff_select on orders for select to authenticated using (public.is_staff_or_admin());
create policy orders_staff_write on orders for insert to authenticated with check (public.is_staff_or_admin());
create policy orders_staff_update on orders for update to authenticated using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

create policy order_items_staff_select on order_items for select to authenticated using (public.is_staff_or_admin());
create policy order_items_staff_insert on order_items for insert to authenticated with check (public.is_staff_or_admin());
create policy order_items_staff_update on order_items for update to authenticated using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

create policy push_subscriptions_public_insert on push_subscriptions for insert to anon with check (true);

create or replace function public.get_public_order(p_order_id uuid)
returns setof orders
language sql
security definer
set search_path = public
as $$ select * from public.orders where id = p_order_id limit 1 $$;

create or replace function public.get_public_order_items(p_order_id uuid)
returns setof order_items
language sql
security definer
set search_path = public
as $$ select * from public.order_items where order_id = p_order_id order by id $$;

create or replace function public.get_public_active_orders()
returns setof orders
language sql
security definer
set search_path = public
as $$
  select * from public.orders
  where status in ('received', 'cooking', 'ready')
  order by created_at asc
$$;

revoke all on function public.get_public_order(uuid) from public;
revoke all on function public.get_public_order_items(uuid) from public;
revoke all on function public.get_public_active_orders() from public;
grant execute on function public.get_public_order(uuid) to anon, authenticated;
grant execute on function public.get_public_order_items(uuid) to anon, authenticated;
grant execute on function public.get_public_active_orders() to anon, authenticated;

create or replace function public.set_item_available(p_item_id bigint, p_is_available boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff_or_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.menu_items set is_available = p_is_available where id = p_item_id;
  if not found then raise exception 'menu item not found' using errcode = 'P0002'; end if;
end;
$$;

create or replace function public.set_option_available(p_option_id bigint, p_is_available boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff_or_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.options set is_available = p_is_available where id = p_option_id;
  if not found then raise exception 'option not found' using errcode = 'P0002'; end if;
end;
$$;

revoke all on function public.set_item_available(bigint, boolean) from public, anon;
revoke all on function public.set_option_available(bigint, boolean) from public, anon;
grant execute on function public.set_item_available(bigint, boolean) to authenticated;
grant execute on function public.set_option_available(bigint, boolean) to authenticated;