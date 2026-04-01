export const ORDER_STATUSES = [
  { label: "受付済み", value: "received" },
  { label: "調理中", value: "preparing" },
  { label: "受け取り可能", value: "ready" },
  { label: "受け取り完了", value: "done" },
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number]["value"];

export function getOrderStatusLabel(status: string) {
  return ORDER_STATUSES.find((item) => item.value === status)?.label ?? status;
}
