"use client";

import { Order, OrderStatus } from "@/types";

const ELAPSED_CLASS = {
  normal: "border-emerald-300/70 bg-white text-emerald-700",
  warning: "border-orange-500/70 bg-white text-orange-700 ring-1 ring-orange-300/40",
  danger: "border-#e62600-400/70 bg-white text-rose-700 ring-1 ring-rose-300/40",
} as const;

const CARD_CLASS = {
  normal: "border-cyan-300/25",
  warning: "border-orange-500",
  danger: "border-red-600",
} as const;

const CARD_BACKGROUND = {
  normal: "transparent",
  warning: "#FF9E50",
  danger: "#e62600",
} as const;

const STATUS_LABEL: Record<OrderStatus, string> = {
  waiting: "待機中",
  ready: "受取可能",
  done: "受取完了",
};

type ElapsedVariant = keyof typeof ELAPSED_CLASS;

interface Props {
  order: Order;
  now: number;
  isUpdating: boolean;
  onUpdate: (id: string, status: OrderStatus) => void;
}

function formatElapsedTime(createdAt: string, now: number) {
  const elapsedSeconds = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const variant: ElapsedVariant = elapsedSeconds > 60 ? "danger" : elapsedSeconds > 20 ? "warning" : "normal";

  return {
    label: `${minutes}:${String(seconds).padStart(2, "0")}`,
    variant,
    tone: ELAPSED_CLASS[variant],
  };
}

export default function OrderCard({ order, now, isUpdating, onUpdate }: Props) {
  const itemsText = order.items.map((i) => `${i.name} x ${i.qty}`).join("、");
  const elapsed = formatElapsedTime(order.created_at, now);

  return (
    <article
      className={`relative isolate overflow-hidden rounded-2xl border p-4 transition-colors duration-300 ${CARD_CLASS[elapsed.variant]}`}
      style={{ backgroundColor: CARD_BACKGROUND[elapsed.variant] }}
    >
      <div className="relative z-10">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-lg font-black text-slate-900">番号 {order.num}</span>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-bold ${elapsed.tone}`}>
              {elapsed.variant === "warning" ? "2分経過" : elapsed.variant === "danger" ? "急いでください！！" : "経過"} {elapsed.label}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-bold ${
                order.status === "waiting"
                  ? "text-yellow-700 border-yellow-400/50 bg-white"
                  : order.status === "ready"
                    ? "text-cyan-700 border-blue-400/50 bg-white"
                    : "text-fuchsia-700 border-blue-400/50 bg-blue"
              }`}
            >
              {STATUS_LABEL[order.status]}
            </span>
          </div>
        </div>
        <p className="text-sm text-slate-700">{itemsText}</p>
        <p className="mb-3 mt-1 text-sm font-black text-cyan-700">¥{order.total.toLocaleString()}</p>
        <div className={`grid gap-2 ${order.status === "ready" ? "grid-cols-3" : "grid-cols-2"}`}>
          <button
            disabled={order.status !== "waiting" || isUpdating}
            onClick={() => onUpdate(order.id, "ready")}
            className="rounded-xl border border-cyan-300/60 bg-white py-3 text-sm font-black text-cyan-700 disabled:opacity-35"
          >
            {isUpdating ? "..." : "受け取り可能"}
          </button>
          <button
            disabled={order.status !== "ready" || isUpdating}
            onClick={() => onUpdate(order.id, "done")}
            className="rounded-xl border border-fuchsia-300/60 bg-white py-3 text-sm font-black text-fuchsia-700 disabled:opacity-35"
          >
            {isUpdating ? "..." : "受け取り完了"}
          </button>
          {order.status === "ready" && (
            <button
              disabled={isUpdating}
              onClick={() => onUpdate(order.id, "waiting")}
              className="rounded-xl border border-slate-300/70 bg-white py-3 text-sm font-black text-slate-700 disabled:opacity-35"
            >
              {isUpdating ? "..." : "戻す"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
