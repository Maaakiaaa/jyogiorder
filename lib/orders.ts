import { supabase } from "./supabase";
import { ensureSeqAtLeast, issueNextNumber, recordRenumberNotice } from "./numbering";
import {
  enqueuePendingOrder,
  getPendingOrder,
  listPendingOrders,
  pendingOrderToOrder,
  recordPendingOrderFailure,
  removePendingOrder,
  updatePendingOrderNumber,
} from "./offlineQueue";
import { BundleSelection, Order, OrderItem, OrderItemOptionSnapshot, OrderItemYakitoriSelection, OrderPrefix, OrderStatus } from "@/types";
import { displayMenuItemName } from "./menu";

export const AUTH_REQUIRED_MESSAGE = "認証エラーです。再ログインしてください";
const MAX_RENUMBER_ATTEMPTS = 5;

export function isAuthError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; status?: unknown };
  return candidate.code === "42501" || candidate.code === "PGRST301" || candidate.status === 401 || candidate.status === 403;
}

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
  yakitori_selections: OrderItemYakitoriSelection[] | null;
  options_snapshot: OrderItemOptionSnapshot[] | null;
  id: number;
  line_id: string | null;
  parent_line_id: string | null;
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
      yakitoriSelections: item.yakitori_selections ?? undefined,
      optionsSnapshot: item.options_snapshot ?? undefined,
      lineId: item.line_id ?? String(item.id),
      parentLineId: item.parent_line_id,
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

async function fetchPublicItemsForOrder(orderId: string): Promise<OrderItemRow[]> {
  const { data, error } = await supabase.rpc("get_public_order_items", { p_order_id: orderId });
  if (error) throw error;
  return (data ?? []) as OrderItemRow[];
}

export type NewOrderItem = {
  menuItemId: number | null;
  name: string;
  price: number;
  qty: number;
  yakitoriSelections?: OrderItemYakitoriSelection[];
  optionsSnapshot?: OrderItemOptionSnapshot[];
  bundleSelections?: BundleSelection[];
  lineId?: string;
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
  } catch (error) {
    // サーバーの状態が確認できない(オフライン等)。楽観的に「未登録」とはみなさない。
    if (isAuthError(error)) {
      recordPendingOrderFailure(orderId, AUTH_REQUIRED_MESSAGE);
      throw new Error(AUTH_REQUIRED_MESSAGE);
    }
    if (pending) {
      return pendingOrderToOrder(recordPendingOrderFailure(orderId, error) ?? pending);
    }

    const total = orderTotalFromNewItems(items);
    const { seq, number } = issueNextNumber(prefix);
    const createdAt = new Date().toISOString();
    const pendingOrder = { orderId, prefix, seq, number, items, total, createdAt, attempts: 0, lastError: null };
    enqueuePendingOrder(pendingOrder, true, false);
    return pendingOrderToOrder(recordPendingOrderFailure(orderId, error) ?? pendingOrder);
  }

  if (existing) {
    removePendingOrder(orderId);
    return existing;
  }

  const total = pending?.total ?? orderTotalFromNewItems(items);
  let { seq, number } = pending ?? issueNextNumber(prefix);
  const createdAt = pending?.createdAt ?? new Date().toISOString();

  if (!pending) {
    enqueuePendingOrder({
      orderId,
      prefix,
      seq,
      number,
      items,
      total,
      createdAt,
      attempts: 0,
      lastError: null,
    }, true, false);
  }

  const originalNumber = number;

  try {
    let insertedOrder: OrderRow | null = null;
    for (let attempt = 0; insertedOrder === null; attempt++) {
      const { data, error: insertOrderError } = await supabase
        .from("orders")
        .insert({ id: orderId, prefix, seq, number, total, status: "received" })
        .select()
        .single();

      if (!insertOrderError) {
        insertedOrder = data as OrderRow;
        break;
      }
      if (insertOrderError.code !== "23505") throw insertOrderError;

      // unique制約違反には2種類ある。orders.id の重複 = 別経路で既に登録済みなので既存注文を返す。
      const raced = await findExistingOrder(orderId);
      if (raced) {
        removePendingOrder(orderId);
        return raced;
      }

      // (prefix, seq) の重複 = 端末の採番位置が巻き戻った(端末交換・ストレージ消去)か、
      // 同じ記号の端末が2台ある。通信失敗として再送し続けても永遠に通らないので、
      // DB上の最大番号まで採番位置を進めてから番号を振り直す。
      if (attempt >= MAX_RENUMBER_ATTEMPTS) {
        throw new Error(`番号 ${number} が既に使われており、振り直しにも失敗しました。同じ記号の端末が複数ないか確認してください`);
      }
      await syncNumberingWithServer(prefix);
      ({ seq, number } = issueNextNumber(prefix));
      updatePendingOrderNumber(orderId, seq, number);
    }

    // 前回の呼び出しで既に番号を返している(=お客様に伝わっている)場合だけ、訂正が必要と知らせる。
    // 初回の会計中に振り直した場合は、画面に出る番号が最初から新しい番号なので訂正は不要。
    if (pending && number !== originalNumber) {
      recordRenumberNotice({ orderId, prefix, from: originalNumber, to: number, at: new Date().toISOString() });
    }

    const expandedItems = items.flatMap((item, index) => {
      const parentLineId = item.lineId ?? `${orderId}:line:${index}`;
      const parent = {
        order_id: orderId,
        line_id: parentLineId,
        parent_line_id: null,
        menu_item_id: item.menuItemId,
        name_snapshot: item.name,
        price_snapshot: item.price,
        qty: item.qty,
        yakitori_selections: item.yakitoriSelections ?? null,
        options_snapshot: item.optionsSnapshot ?? null,
      };
      if (!item.bundleSelections || item.bundleSelections.length === 0) return [parent];
      return [
        parent,
        ...item.bundleSelections.map((selection) => ({
          order_id: orderId,
          line_id: `${parentLineId}:slot:${selection.slotId}`,
          parent_line_id: parentLineId,
          menu_item_id: selection.menuItem.id,
          name_snapshot: `${selection.slotName}: ${displayMenuItemName(selection.menuItem, selection.options)}`,
          price_snapshot: 0,
          qty: item.qty,
          yakitori_selections: selection.yakitoriSelections?.map((skewer) => ({
            flavorName: skewer.flavorName,
            typeName: skewer.typeName,
          })) ?? null,
          options_snapshot: selection.options.length > 0 ? selection.options.map((option) => ({
            id: option.id,
            groupId: option.groupId,
            groupName: selection.menuItem.optionGroups.find((group) => group.id === option.groupId)?.name ?? "選択肢",
            name: option.name,
            priceDelta: option.priceDelta,
          })) : null,
        })),
      ];
    });
    const { error: insertItemsError } = await supabase.from("order_items").insert(expandedItems);

    if (insertItemsError) throw insertItemsError;

    removePendingOrder(orderId);
    return fromRows(insertedOrder as OrderRow, await fetchItemsForOrder(orderId));
  } catch (error) {
    // 番号はキューに確保済みなので、そのまま返してオンライン復帰時の再送に委ねる。
    const failed = recordPendingOrderFailure(orderId, error);
    if (isAuthError(error)) throw new Error(AUTH_REQUIRED_MESSAGE);
    return pendingOrderToOrder(
      failed ?? { orderId, prefix, seq, number, items, total, createdAt, attempts: 1, lastError: "送信に失敗しました" }
    );
  }
}

// 端末の採番位置がDB上の最大番号より遅れていたら追いつかせる。採番そのものは引き続き端末で行い、
// DBは「既に使われた番号」を知るための参照にだけ使う(オフラインならそのまま端末の値で採番を続ける)。
export async function syncNumberingWithServer(prefix: OrderPrefix): Promise<void> {
  const { data, error } = await supabase
    .from("orders")
    .select("seq")
    .eq("prefix", prefix)
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data) ensureSeqAtLeast(prefix, (data as { seq: number }).seq);
}

// オフラインキューに溜まった注文を再送する。オンライン復帰時・定期ポーリングから呼ぶ。
// 各要素はplaceOrder()を再実行するだけで、成功すればキューから自動的に外れる。
export async function flushPendingOrders(): Promise<number> {
  for (const pending of listPendingOrders()) {
    try {
      await placeOrder(pending.orderId, pending.prefix, pending.items);
    } catch (error) {
      recordPendingOrderFailure(pending.orderId, error);
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
  const { data, error } = await supabase.rpc("get_public_order", { p_order_id: id }).maybeSingle();
  if (error || !data) return null;
  return fromRows(data as OrderRow, await fetchPublicItemsForOrder(id));
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

async function attachPublicItems(orders: OrderRow[]): Promise<Order[]> {
  if (orders.length === 0) return [];

  const itemResults = await Promise.all(orders.map((order) => fetchPublicItemsForOrder(order.id)));
  return orders.map((order, index) => fromRows(order, itemResults[index]));
}

// 調理ディスプレイ・呼び出しボード用: 進行中(受付/調理中/完了)の注文のみ
export async function fetchActiveOrders(): Promise<Order[]> {
  const { data, error } = await supabase.rpc("get_public_active_orders");

  if (error) throw error;
  return attachPublicItems((data ?? []) as OrderRow[]);
}

// 誤タップでの取消・お渡し完了から復帰できるよう、直近の該当注文を調理ディスプレイに出す用。
async function fetchRecentOrdersByStatus(status: OrderStatus, limit: number): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("status", status)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return attachItems((data ?? []) as OrderRow[]);
}

export function fetchRecentCancelledOrders(): Promise<Order[]> {
  return fetchRecentOrdersByStatus("cancelled", 20);
}

export function fetchRecentHandedOrders(): Promise<Order[]> {
  return fetchRecentOrdersByStatus("handed", 5);
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
