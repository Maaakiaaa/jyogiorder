"use client";

import { Order, OrderStatus } from "@/types";

const ELAPSED_CLASS = {
  normal: "border-emerald-300/70 bg-white text-emerald-700",
  warning: "border-orange-500/70 bg-white text-orange-700 ring-1 ring-orange-300/40",
  danger: "border-rose-500/70 bg-white text-rose-700 ring-1 ring-rose-300/40",
} as const;

const CARD_CLASS = {
  normal: "border-line",
  warning: "border-orange-500",
  danger: "border-red-600",
} as const;

const CARD_BACKGROUND = {
  normal: "transparent",
  warning: "#FF9E50",
  danger: "#e62600",
} as const;

const STATUS_LABEL: Record<OrderStatus, string> = {
  received: "受付",
  cooking: "調理中",
  ready: "呼び出し中",
  handed: "受け渡し済み",
  cancelled: "取消",
};

type ElapsedVariant = keyof typeof ELAPSED_CLASS;

interface Props {
  order: Order;
  now: number;
  isUpdating: boolean;
  onAdvance: (id: string) => void;
  onBack: (id: string) => void;
  onCancel: (id: string) => void;
}

function formatElapsedTime(createdAt: string, now: number) {
  const elapsedSeconds = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const variant: ElapsedVariant = elapsedSeconds > 300 ? "danger" : elapsedSeconds > 120 ? "warning" : "normal";

  return {
    label: `${minutes}:${String(seconds).padStart(2, "0")}`,
    variant,
    tone: ELAPSED_CLASS[variant],
  };
}

export default function OrderCard({ order, now, isUpdating, onAdvance, onBack, onCancel }: Props) {
  const itemsText = order.items.map((i) => `${i.name} x ${i.qty}`).join("、");
  const elapsed = formatElapsedTime(order.created_at, now);

  return (
    <article
      className={`relative isolate overflow-hidden rounded-2xl border p-4 transition-colors duration-300 ${CARD_CLASS[elapsed.variant]}`}
      style={{ backgroundColor: CARD_BACKGROUND[elapsed.variant] }}
    >
      <div className="relative z-10">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-lg font-black text-ink">番号 {order.number}</span>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-bold ${elapsed.tone}`}>
              経過 {elapsed.label}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-bold ${
                order.status === "received" || order.status === "cooking"
                  ? "text-brand-gold border-brand-gold/50 bg-white"
                  : "text-brand-indigo border-brand-indigo/40 bg-white"
              }`}
            >
              {STATUS_LABEL[order.status]}
            </span>
          </div>
        </div>
        <p className="text-sm text-ink">{itemsText}</p>
        <p className="mb-3 mt-1 text-sm font-black text-brand-indigo">¥{order.total.toLocaleString()}</p>
        <div className="grid grid-cols-3 gap-2">
          <button
            disabled={order.status !== "cooking" || isUpdating}
            onClick={() => onBack(order.id)}
            className="rounded-xl border border-line bg-white py-3 text-sm font-black text-sub disabled:opacity-35"
          >
            {isUpdating ? "..." : "戻す"}
          </button>
          <button
            disabled={order.status === "ready" || isUpdating}
            onClick={() => onAdvance(order.id)}
            className="rounded-xl border border-brand-indigo/40 bg-white py-3 text-sm font-black text-brand-indigo disabled:opacity-35"
          >
            {isUpdating ? "..." : order.status === "received" ? "調理を始める" : "できあがり"}
          </button>
          <button
            disabled={isUpdating}
            onClick={() => onCancel(order.id)}
            className="rounded-xl border border-brand-vermilion/40 bg-white py-3 text-sm font-black text-brand-vermilion disabled:opacity-35"
          >
            {isUpdating ? "..." : "取消"}
          </button>
        </div>
      </div>
    </article>
  );
}
