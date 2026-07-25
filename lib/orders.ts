import { supabase } from "./supabase";
import { issueNextNumber } from "./numbering";
import {
  enqueuePendingOrder,
  getPendingOrder,
  listPendingOrders,
  pendingOrderToOrder,
  removePendingOrder,
} from "./offlineQueue";
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

// fetchOrder()はUI側のポーリング用に「取得できなければnull」という緩い契約にしているため、
// ネットワーク断と「本当に存在しない」を区別できない。冪等性の判定にはその区別が必須なので、
// ここではエラーを飲み込まずそのまま投げる専用の取得関数を使う。
async function findExistingOrder(orderId: string): Promise<Order | null> {
  const { data, error } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return fromRows(data as OrderRow, await fetchItemsForOrder(orderId));
}

// 冪等な注文確定: 同じ orderId が二度渡された場合(二重スキャン・オフライン復帰後の再送)は、
// 新規作成せず既存の注文をそのまま返す。番号は既存注文(またはオフラインキューに確保済みの分)が
// あればそれを使い、まだどこにもなければここで一度だけ issueNextNumber() する。
//
// 通信不良でDBへの書き込みが確定できない場合でも、番号はローカルで確保済みなのでその場で返す。
// 確保した内容はオフラインキュー(lib/offlineQueue.ts)に積んでおき、flushPendingOrders()で
// オンライン復帰後に再送する(spec: 番号返却の失敗より、番号を使い切ってでも壊れないことを優先する)。
export async function placeOrder(
  orderId: string,
  prefix: OrderPrefix,
  items: NewOrderItem[]
): Promise<Order> {
  const pending = getPendingOrder(orderId);

  let existing: Order | null = null;
  try {
    existing = await findExistingOrder(orderId);
  } catch {
    // サーバーの状態が確認できない(オフライン等)。楽観的に「未登録」とはみなさない。
    if (pending) return pendingOrderToOrder(pending);

    const total = orderTotalFromNewItems(items);
    const { seq, number } = issueNextNumber(prefix);
    const createdAt = new Date().toISOString();
    enqueuePendingOrder({ orderId, prefix, seq, number, items, total, createdAt });
    return pendingOrderToOrder({ orderId, prefix, seq, number, items, total, createdAt });
  }

  if (existing) {
    removePendingOrder(orderId);
    return existing;
  }

  const total = pending?.total ?? orderTotalFromNewItems(items);
  const { seq, number } = pending ?? issueNextNumber(prefix);
  const createdAt = pending?.createdAt ?? new Date().toISOString();

  if (!pending) {
    enqueuePendingOrder({ orderId, prefix, seq, number, items, total, createdAt });
  }

  try {
    const { data: insertedOrder, error: insertOrderError } = await supabase
      .from("orders")
      .insert({ id: orderId, prefix, seq, number, total, status: "received" })
      .select()
      .single();

    if (insertOrderError) {
      if (insertOrderError.code === "23505") {
        // unique制約違反(orders.id 重複) = 別経路で既に登録済み。既存注文を返す。
        const raced = await findExistingOrder(orderId).catch(() => null);
        if (raced) {
          removePendingOrder(orderId);
          return raced;
        }
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

    removePendingOrder(orderId);
    return fromRows(insertedOrder as OrderRow, await fetchItemsForOrder(orderId));
  } catch {
    // 番号はキューに確保済みなので、そのまま返してオンライン復帰時の再送に委ねる。
    return pendingOrderToOrder({ orderId, prefix, seq, number, items, total, createdAt });
  }
}

// オフラインキューに溜まった注文を再送する。オンライン復帰時・定期ポーリングから呼ぶ。
// 各要素はplaceOrder()を再実行するだけで、成功すればキューから自動的に外れる。
export async function flushPendingOrders(): Promise<number> {
  for (const pending of listPendingOrders()) {
    try {
      await placeOrder(pending.orderId, pending.prefix, pending.items);
    } catch {
      // まだオフライン。次回に持ち越す。
    }
  }
  return listPendingOrders().length;
}

function orderTotalFromNewItems(items: NewOrderItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
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
