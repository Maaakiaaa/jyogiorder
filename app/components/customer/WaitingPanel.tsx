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
  if (status === "received") {
    return { backgroundColor: "#5B4A00", borderColor: "#FACC15", color: "#FEF08A" };
  }
  if (status === "cooking") {
    return { backgroundColor: "#5B4A00", borderColor: "#FACC15", color: "#FEF08A" };
  }
  if (status === "ready") {
    return { backgroundColor: "#064E3B", borderColor: "#34D399", color: "#A7F3D0" };
  }
  if (status === "cancelled") {
    return { backgroundColor: "#4A0410", borderColor: "#F87171", color: "#FECACA" };
  }
  return { backgroundColor: "#4A044E", borderColor: "#E879F9", color: "#F5D0FE" };
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
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-200/80">Order Status</p>
          <button
            onClick={onBackToMenu}
            className="rounded-xl border border-cyan-300/40 bg-slate-900/65 px-3 py-2 text-xs font-bold text-cyan-100"
          >
            追加注文する
          </button>
        </div>
        <h1 className="mt-2 text-2xl font-black neon-title">お客様情報</h1>

        <div className="mt-4 rounded-2xl border border-cyan-300/25 bg-slate-950/60 p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-cyan-200/80">MY ORDERS</p>
          <div className="grid grid-cols-3 gap-2">
            {orders.map((o) => (
              <button
                key={o.id}
                onClick={() => onSelectOrder(o.id)}
                className={`rounded-xl border px-2 py-2 transition ${
                  activeOrderId === o.id
                    ? "border-cyan-300/80 bg-cyan-300/15 text-cyan-100"
                    : "border-white/15 bg-slate-900/60 text-slate-200"
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

        <div className="mt-5 rounded-2xl border border-cyan-300/35 bg-slate-950/70 p-4">
          <p className="text-sm text-slate-300">呼び出し番号</p>
          <p className="neon-title mt-2 text-6xl font-black text-cyan-200">{currentOrder.number}</p>
        </div>

        <div className="mt-6 rounded-2xl border border-fuchsia-300/30 bg-slate-900/60 p-4">
          <div className="mb-3 grid grid-cols-3 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-slate-300">
            <span className={progress >= 25 ? "text-cyan-200" : ""}>注文済み</span>
            <span className={currentOrder.status === "cooking" ? "flashing-cooking text-yellow-200" : "text-cyan-200"}>調理中</span>
            <span className={progress === 100 ? "text-fuchsia-200" : ""}>受け取り可能</span>
          </div>

          <div className="h-6 overflow-hidden rounded-full border border-cyan-300/40 bg-slate-950/70 p-[3px]">
            <div
              className="liquid-progress h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="mt-4 text-sm text-cyan-100/90">
            {currentOrder.status === "ready"
              ? "受け取り可能です。カウンターまでお越しください。"
              : currentOrder.status === "cancelled"
                ? "この注文は取り消されました。レジまでお問い合わせください。"
                : "調理中です。画面は自動更新されます。"}
          </p>
        </div>

        <div className="mt-5 rounded-2xl border border-cyan-300/25 bg-slate-950/60 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-200/80">注文内容</p>
          <div className="space-y-1">
            {currentOrder.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm text-slate-200">
                <span>{item.name} x {item.qty}</span>
                <span>¥{(item.price * item.qty).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between border-t border-slate-700 pt-3 text-base font-black text-white">
            <span>TOTAL</span>
            <span>¥{currentOrder.total.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </main>
  );
}
