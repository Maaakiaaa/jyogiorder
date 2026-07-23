import { supabase } from "./supabase";
import { issueNextNumber } from "./numbering";
import { Order, OrderItem, OrderPrefix, OrderStatus } from "@/types";

type OrderRow = {
  id: string;
  prefix: OrderPrefix;
  seq: number;
  number: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  updated_at: string;
};

type OrderItemRow = {
  order_id: string;
  menu_item_id: number | null;
  name_snapshot: string;
  price_snapshot: number;
  qty: number;
};

function fromRows(order: OrderRow, items: OrderItemRow[]): Order {
  return {
    id: order.id,
    prefix: order.prefix,
    seq: order.seq,
    number: order.number,
    status: order.status,
    total: order.total,
    created_at: order.created_at,
    updated_at: order.updated_at,
    items: items.map((item) => ({
      menuItemId: item.menu_item_id,
      name: item.name_snapshot,
      price: item.price_snapshot,
      qty: item.qty,
    })),
  };
}

async function fetchItemsForOrder(orderId: string): Promise<OrderItemRow[]> {
  const { data, error } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);

  if (error) throw error;
  return data ?? [];
}

export type NewOrderItem = {
  menuItemId: number | null;
  name: string;
  price: number;
  qty: number;
};

// 冪等な注文確定: 同じ orderId が二度渡された場合(二重スキャン・オフライン復帰後の再送)は、
// 新規作成せず既存の注文をそのまま返す。番号は既存注文があればそれを使う。
// 番号発行(issueNextNumber)は、まだ存在しない注文が確定した場合の一度だけ行われる。
export async function placeOrder(
  orderId: string,
  prefix: OrderPrefix,
  items: NewOrderItem[]
): Promise<Order> {
  const existing = await fetchOrder(orderId);
  if (existing) return existing;

  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const { seq, number } = issueNextNumber(prefix);

  const { data: insertedOrder, error: insertOrderError } = await supabase
    .from("orders")
    .insert({ id: orderId, prefix, seq, number, total, status: "received" })
    .select()
    .single();

  if (insertOrderError) {
    // 発行済み番号がここで無駄になるが、ローカル採番はDBの成否に関わらず前に進める
    // (spec: 番号返却の失敗より、番号を使い切ってでも壊れないことを優先する)。
    if (insertOrderError.code === "23505") {
      // unique制約違反(orders.id 重複) = 別経路で既に登録済み。既存注文を返す。
      const raced = await fetchOrder(orderId);
      if (raced) return raced;
    }
    throw insertOrderError;
  }

  const { error: insertItemsError } = await supabase.from("order_items").insert(
    items.map((item) => ({
      order_id: orderId,
      menu_item_id: item.menuItemId,
      name_snapshot: item.name,
      price_snapshot: item.price,
      qty: item.qty,
    }))
  );

  if (insertItemsError) throw insertItemsError;

  return fromRows(insertedOrder as OrderRow, await fetchItemsForOrder(orderId));
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function fetchOrder(id: string): Promise<Order | null> {
  const { data, error } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return fromRows(data as OrderRow, await fetchItemsForOrder(id));
}

async function attachItems(orders: OrderRow[]): Promise<Order[]> {
  if (orders.length === 0) return [];

  const { data: itemRows, error } = await supabase
    .from("order_items")
    .select("*")
    .in("order_id", orders.map((o) => o.id));

  if (error) throw error;

  const itemsByOrder = new Map<string, OrderItemRow[]>();
  for (const item of (itemRows ?? []) as OrderItemRow[]) {
    const list = itemsByOrder.get(item.order_id) ?? [];
    list.push(item);
    itemsByOrder.set(item.order_id, list);
  }

  return orders.map((order) => fromRows(order, itemsByOrder.get(order.id) ?? []));
}

// 調理ディスプレイ・呼び出しボード用: 進行中(受付/調理中/完了)の注文のみ
export async function fetchActiveOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .in("status", ["received", "cooking", "ready"])
    .order("created_at", { ascending: true });

  if (error) throw error;
  return attachItems((data ?? []) as OrderRow[]);
}

export async function fetchSalesOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return attachItems((data ?? []) as OrderRow[]);
}

export function orderTotalFromItems(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}
