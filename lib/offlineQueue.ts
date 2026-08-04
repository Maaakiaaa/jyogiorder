import type { NewOrderItem } from "./orders";
import { Order, OrderPrefix } from "@/types";

const QUEUE_KEY = "jyogi:pending-orders";

export type PendingOrder = {
  orderId: string;
  prefix: OrderPrefix;
  seq: number;
  number: string;
  items: NewOrderItem[];
  total: number;
  createdAt: string;
};

function readQueue(): PendingOrder[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as PendingOrder[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingOrder[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

// 通信不良でDB書き込みが確定しなかった注文を、番号を確保したままキューに積む。
// 発行済みの番号を再利用できるよう、orderIdをキーに1件だけ保持する。
export function enqueuePendingOrder(order: PendingOrder): void {
  const queue = readQueue();
  if (queue.some((o) => o.orderId === order.orderId)) return;
  queue.push(order);
  writeQueue(queue);
}

export function getPendingOrder(orderId: string): PendingOrder | null {
  return readQueue().find((o) => o.orderId === orderId) ?? null;
}

export function removePendingOrder(orderId: string): void {
  writeQueue(readQueue().filter((o) => o.orderId !== orderId));
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
    })),
    created_at: pending.createdAt,
    updated_at: pending.createdAt,
  };
}
