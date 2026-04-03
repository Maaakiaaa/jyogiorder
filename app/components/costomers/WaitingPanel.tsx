"use client";

import { useEffect, useCallback, useState } from "react";
import { Order } from "@/types";
import { fetchOrder } from "@/lib/orders";
import { supabase } from "@/lib/supabase";

interface Props {
  order: Order;
  onDone: () => void;
}

function progressValue(status: Order["status"]) {
  if (status === "waiting") return 45;
  if (status === "ready") return 100;
  if (status === "done") return 100;
  return 20;
}

export default function WaitingPanel({ order, onDone }: Props) {
  const [currentOrder, setCurrentOrder] = useState<Order>(order);

  const poll = useCallback(async () => {
    const latest = await fetchOrder(currentOrder.id);
    if (!latest) return;
    setCurrentOrder(latest);
    if (latest.status === "done") {
      onDone();
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
        (payload: any) => {
          const updated = payload.new as Order;
          setCurrentOrder(updated);
          if (updated.status === "done") {
            onDone();
          }
        }
      )
      .subscribe();

    const timer = setInterval(poll, 4000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, [currentOrder.id, onDone, poll]);

  const progress = progressValue(currentOrder.status);

  return (
    <main className="festival-bg min-h-screen px-3 py-3">
      <div className="relative z-10 mx-auto w-full max-w-md rounded-[28px] glass-panel p-5">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-200/80">Order Status</p>
        <h1 className="mt-2 text-2xl font-black neon-title">TRACKING</h1>

        <div className="mt-5 rounded-2xl border border-cyan-300/35 bg-slate-950/70 p-4">
          <p className="text-sm text-slate-300">呼び出し番号</p>
          <p className="neon-title mt-2 text-6xl font-black text-cyan-200">{currentOrder.num}</p>
        </div>

        <div className="mt-6 rounded-2xl border border-fuchsia-300/30 bg-slate-900/60 p-4">
          <div className="mb-3 grid grid-cols-3 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-slate-300">
            <span className={progress >= 20 ? "text-cyan-200" : ""}>ORDERED</span>
            <span className={currentOrder.status === "waiting" ? "flashing-cooking text-yellow-200" : "text-cyan-200"}>COOKING</span>
            <span className={progress === 100 ? "text-fuchsia-200" : ""}>READY</span>
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
              : "調理中です。画面は自動更新されます。"}
          </p>
        </div>

        <div className="mt-5 rounded-2xl border border-cyan-300/25 bg-slate-950/60 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-200/80">Order Items</p>
          <div className="space-y-1">
            {currentOrder.items.map((item: any, i: number) => (
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
