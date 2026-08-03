"use client";

import { useEffect, useCallback, useState } from "react";
import type { RealtimePostgresUpdatePayload } from "@supabase/supabase-js";
import { Order, OrderStatus } from "@/types";
import { fetchOrder } from "@/lib/orders";
import { supabase } from "@/lib/supabase";

interface Props {
  order: Order;
  orders: Order[];
  activeOrderId: string;
  onSelectOrder: (orderId: string) => void;
  onDone: (orderId: string) => void;
  onBackToMenu: () => void;
}

function progressValue(status: OrderStatus) {
  if (status === "received") return 25;
  if (status === "cooking") return 60;
  if (status === "ready") return 100;
  if (status === "handed") return 100;
  return 0;
}

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  received: "受付済み",
  cooking: "調理中",
  ready: "受取可能",
  handed: "受け渡し済み",
  cancelled: "取消",
};

type OrderRow = {
  id: string;
  status: OrderStatus;
};

type OrderRealtimePayload = RealtimePostgresUpdatePayload<OrderRow & Record<string, unknown>>;

function orderStatusBadgeStyle(status: OrderStatus) {
  if (status === "received" || status === "cooking") {
    return { backgroundColor: "#FBF2DD", borderColor: "#C88A1A", color: "#7A5A0E" };
  }
  if (status === "ready") {
    return { backgroundColor: "#E3F5EC", borderColor: "#1F9D63", color: "#0F6B44" };
  }
  if (status === "cancelled") {
    return { backgroundColor: "#FBE7DF", borderColor: "#E4572E", color: "#9A3412" };
  }
  return { backgroundColor: "#EDF0F3", borderColor: "#D6DCE2", color: "#5B6472" };
}

export default function WaitingPanel({ order, orders, activeOrderId, onSelectOrder, onDone, onBackToMenu }: Props) {
  const [currentOrder, setCurrentOrder] = useState<Order>(order);

  useEffect(() => {
    setCurrentOrder(order);
  }, [order]);

  const poll = useCallback(async () => {
    const latest = await fetchOrder(currentOrder.id);
    if (!latest) return;
    setCurrentOrder(latest);
    if (latest.status === "handed") {
      onDone(latest.id);
    }
  }, [currentOrder.id, onDone]);

  useEffect(() => {
    const channel = supabase
      .channel(`order-${currentOrder.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${currentOrder.id}`,
        },
        (payload: OrderRealtimePayload) => {
          // 行の更新通知だけを合図にして、実体は取り直す(保険としての再取得)。
          void poll();
          if (payload.new.status === "handed") {
            onDone(payload.new.id);
          }
        }
      )
      .subscribe();

    const timer = setInterval(poll, 4000);
    void poll();

    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrder.id]);

  const progress = progressValue(currentOrder.status);

  return (
    <main className="festival-bg min-h-screen px-3 py-3">
      <div className="relative z-10 mx-auto w-full max-w-md rounded-[28px] glass-panel p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-sub">Order Status</p>
          <button
            onClick={onBackToMenu}
            className="rounded-xl border border-line bg-canvas px-3 py-2 text-xs font-bold text-brand-indigo"
          >
            追加注文する
          </button>
        </div>
        <h1 className="mt-2 text-2xl neon-title text-ink">お客様情報</h1>

        <div className="mt-4 rounded-2xl border border-line bg-canvas p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-sub">MY ORDERS</p>
          <div className="grid grid-cols-3 gap-2">
            {orders.map((o) => (
              <button
                key={o.id}
                onClick={() => onSelectOrder(o.id)}
                className={`rounded-xl border px-2 py-2 transition ${
                  activeOrderId === o.id
                    ? "border-brand-indigo/60 bg-brand-indigo/10 text-brand-indigo"
                    : "border-line bg-surface text-sub"
                }`}
              >
                <span className="block text-sm font-black">#{o.number}</span>
                <span
                  className="mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-[0.08em]"
                  style={orderStatusBadgeStyle(o.status)}
                >
                  {ORDER_STATUS_LABEL[o.status]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-line bg-canvas p-4">
          <div className="text-center">
            <p className="text-sm text-sub">呼び出し番号</p>
            <p className="neon-title mt-2 text-6xl text-brand-indigo">{currentOrder.number}</p>
          </div>

          <div className="mt-4 space-y-1 border-t border-line pt-4">
            {currentOrder.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm text-ink">
                <span>{item.name} x {item.qty}</span>
                <span>¥{(item.price * item.qty).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between border-t border-line pt-3 text-base font-black text-ink">
            <span>TOTAL</span>
            <span>¥{currentOrder.total.toLocaleString()}</span>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-line bg-surface p-4">
          <div className="mb-3 grid grid-cols-3 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-sub">
            <span className={progress >= 25 ? "text-brand-indigo" : ""}>注文済み</span>
            <span className={currentOrder.status === "cooking" ? "flashing-cooking text-brand-gold" : "text-brand-indigo"}>調理中</span>
            <span className={progress === 100 ? "text-brand-vermilion" : ""}>受け取り可能</span>
          </div>

          <div className="h-6 overflow-hidden rounded-full border border-line bg-canvas p-[3px]">
            <div
              className="liquid-progress h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="mt-4 text-sm text-sub">
            {currentOrder.status === "ready"
              ? "受け取り可能です。カウンターまでお越しください。"
              : currentOrder.status === "cancelled"
                ? "この注文は取り消されました。レジまでお問い合わせください。"
                : "調理中です。画面は自動更新されます。"}
          </p>
        </div>
      </div>
    </main>
  );
}
