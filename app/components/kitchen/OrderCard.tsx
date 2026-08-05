"use client";

import { Order, OrderStatus } from "@/types";

const CARD_BACKGROUND = "#659AD2";

const STATUS_LABEL: Record<OrderStatus, string> = {
  received: "受付",
  cooking: "調理中",
  ready: "呼び出し中",
  handed: "受け渡し済み",
  cancelled: "取消",
};

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
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function OrderCard({ order, now, isUpdating, onAdvance, onBack, onCancel }: Props) {
  const elapsedLabel = formatElapsedTime(order.created_at, now);

  return (
    <article
      className="relative isolate overflow-hidden rounded-2xl border border-line p-4"
      style={{ backgroundColor: CARD_BACKGROUND }}
    >
      <div className="relative z-10">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-2xl font-black text-ink">番号 {order.number}</span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/70 bg-white px-3 py-1 text-sm font-bold text-ink">
              経過 {elapsedLabel}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-sm font-bold ${
                order.status === "received" || order.status === "cooking"
                  ? "text-brand-gold border-brand-gold/50 bg-white"
                  : "text-brand-indigo border-brand-indigo/40 bg-white"
              }`}
            >
              {STATUS_LABEL[order.status]}
            </span>
          </div>
        </div>
        <div className="space-y-1">
          {order.items.map((i, idx) => (
            <p key={idx} className="text-base text-ink">
              {i.name} x {i.qty}
              {i.yakitoriSelections && (
                <span className="block text-sm text-[#005133]">
                  {i.yakitoriSelections.map((s, si) => `${si + 1}.${s.typeName}×${s.flavorName}`).join("、")}
                </span>
              )}
            </p>
          ))}
        </div>
        <p className="mb-3 mt-1 text-base font-black text-brand-indigo">¥{order.total.toLocaleString()}</p>
        <div className="grid grid-cols-3 gap-2">
          <button
            disabled={order.status !== "cooking" || isUpdating}
            onClick={() => onBack(order.id)}
            className="rounded-xl border border-line bg-white py-2 text-xs font-bold text-sub disabled:opacity-35"
          >
            {isUpdating ? "..." : "戻す"}
          </button>
          <button
            disabled={order.status === "ready" || isUpdating}
            onClick={() => onAdvance(order.id)}
            className="rounded-xl border border-brand-indigo/40 bg-white py-2 text-xs font-bold text-brand-indigo disabled:opacity-35"
          >
            {isUpdating ? "..." : order.status === "received" ? "調理を始める" : "できあがり"}
          </button>
          <button
            disabled={isUpdating}
            onClick={() => onCancel(order.id)}
            className="rounded-xl border border-brand-vermilion/40 bg-white py-2 text-xs font-bold text-brand-vermilion disabled:opacity-35"
          >
            {isUpdating ? "..." : "取消"}
          </button>
        </div>
      </div>
    </article>
  );
}
