import type { NewOrderItem } from "./orders";
import { Order, OrderPrefix } from "@/types";
import { displayMenuItemName } from "./menu";

const QUEUE_KEY = "jyogi:pending-orders";

export type PendingOrder = {
  orderId: string;
  prefix: OrderPrefix;
  seq: number;
  number: string;
  items: NewOrderItem[];
  total: number;
  createdAt: string;
  attempts: number;
  lastError: string | null;
};

function readQueue(): PendingOrder[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const queue = raw ? (JSON.parse(raw) as Partial<PendingOrder>[]) : [];
    return queue.map((order) => ({
      ...order,
      attempts: order.attempts ?? 0,
      lastError: order.lastError ?? null,
    })) as PendingOrder[];
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingOrder[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function notifyQueueChanged(reason: "enqueue" | "failure" | "remove", triggerSync = true): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("jyogi:pending-orders-changed", { detail: { reason, triggerSync } })
    );
  }
}

// 通信不良でDB書き込みが確定しなかった注文を、番号を確保したままキューに積む。
// 発行済みの番号を再利用できるよう、orderIdをキーに1件だけ保持する。
export function enqueuePendingOrder(order: PendingOrder, notify = true, triggerSync = true): void {
  const queue = readQueue();
  if (queue.some((o) => o.orderId === order.orderId)) return;
  queue.push(order);
  writeQueue(queue);
  if (notify) notifyQueueChanged("enqueue", triggerSync);
}

export function recordPendingOrderFailure(orderId: string, error: unknown): PendingOrder | null {
  const queue = readQueue();
  const index = queue.findIndex((order) => order.orderId === orderId);
  if (index < 0) return null;

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String(error.message)
        : String(error);
  const updated = {
    ...queue[index],
    attempts: queue[index].attempts + 1,
    lastError: message || "送信に失敗しました",
  };
  queue[index] = updated;
  writeQueue(queue);
  notifyQueueChanged("failure");
  return updated;
}

// 番号の重複が判明して振り直したとき用。キューに残る番号も新しい番号に揃える。
export function updatePendingOrderNumber(orderId: string, seq: number, number: string): void {
  const queue = readQueue();
  const index = queue.findIndex((order) => order.orderId === orderId);
  if (index < 0) return;
  queue[index] = { ...queue[index], seq, number };
  writeQueue(queue);
  notifyQueueChanged("remove");
}

export function getPendingOrder(orderId: string): PendingOrder | null {
  return readQueue().find((o) => o.orderId === orderId) ?? null;
}

export function removePendingOrder(orderId: string): void {
  const queue = readQueue();
  if (!queue.some((order) => order.orderId === orderId)) return;
  writeQueue(queue.filter((o) => o.orderId !== orderId));
  notifyQueueChanged("remove");
}

export function listPendingOrders(): PendingOrder[] {
  return readQueue();
}

export function pendingOrderToOrder(pending: PendingOrder): Order {
  return {
    id: pending.orderId,
    prefix: pending.prefix,
    seq: pending.seq,
    number: pending.number,
    status: "received",
    total: pending.total,
    items: pending.items.map((item) => ({
      menuItemId: item.menuItemId,
      name: item.name,
      price: item.price,
      qty: item.qty,
      yakitoriSelections: item.yakitoriSelections,
      optionsSnapshot: item.optionsSnapshot,
      bundleSnapshot: item.bundleSelections?.map((selection) => ({
        slotId: selection.slotId,
        slotName: selection.slotName,
        menuItemId: selection.menuItem.id,
        name: displayMenuItemName(selection.menuItem, selection.options),
        optionsSnapshot: selection.options.length > 0 ? selection.options.map((option) => ({
          id: option.id,
          groupId: option.groupId,
          groupName: selection.menuItem.optionGroups.find((group) => group.id === option.groupId)?.name ?? "選択肢",
          name: option.name,
          priceDelta: option.priceDelta,
        })) : undefined,
      })),
    })),
    created_at: pending.createdAt,
    updated_at: pending.createdAt,
  };
}
