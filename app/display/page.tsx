"use client";

import { useEffect, useState, useCallback } from "react";
import { Order } from "@/types";
import { fetchAllOrders } from "@/lib/orders";
import { supabase } from "@/lib/supabase";

export default function DisplayPage() {
  const [orders, setOrders] = useState<Order[]>([]);

  const load = useCallback(() => {
    fetchAllOrders()
      .then((data) => setOrders(data))
      .catch(() => {
        // silent
      });
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 3000);
    const channel = supabase
      .channel("display-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, [load]);

  const readyOrders = orders.filter((o) => o.status === "ready");
  const waitingOrders = orders.filter((o) => o.status === "waiting");
  const cookingCards = waitingOrders.slice(0, 8);

  return (
    <main className="festival-bg min-h-screen px-3 py-3">
      <div className="relative z-10 mx-auto flex min-h-[88vh] w-full max-w-md flex-col gap-3 overflow-hidden rounded-[28px] glass-panel p-4">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-24px] top-8 h-40 w-40 rounded-full bg-fuchsia-500/15 blur-3xl" />
          <div className="absolute right-[-28px] top-36 h-44 w-44 rounded-full bg-cyan-400/12 blur-3xl" />
          <div className="absolute bottom-12 left-8 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl" />
        </div>

        <header className="relative z-10 text-center">
          <p className="text-sm font-black tracking-[0.3em] text-white neon-title">受け取り可能番号</p>
        </header>

        {orders.length === 0 && (
          <div className="relative z-10 flex min-h-[70vh] flex-col items-center justify-center rounded-[28px] border border-white/10 bg-slate-950/60 text-slate-300">
            <p className="text-6xl">🎪</p>
            <p className="mt-4 text-xl font-bold">注文が入ると表示されます</p>
          </div>
        )}

        {readyOrders.length > 0 && (
          <section className="relative z-10 rounded-[34px] border-[4px] border-emerald-400/80 bg-slate-950/70 px-4 py-4 shadow-[0_0_36px_rgba(34,197,94,0.54)]">
            <p className="text-center text-[25px] font-bold uppercase tracking-[0.3em] text-emerald-200/90">READY</p>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {readyOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex aspect-[8/3] flex-col items-center justify-center rounded-[18px] border-2 border-emerald-300/80 bg-slate-900/80 px-1 text-center shadow-[0_0_18px_rgba(34,197,94,0.34)]"
                >
                  <p className="text-[50px] font-black leading-none text-white neon-title">{order.num}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="relative z-10 rounded-[26px] border border-cyan-300/25 bg-slate-950/55 px-3 py-2.5 shadow-[0_0_20px_rgba(46,242,255,0.14)]">
          <p className="text-center text-sm font-black text-white neon-title">調理中！</p>

          {cookingCards.length > 0 ? (
            <div className="mt-2 grid grid-cols-4 gap-2">
              {cookingCards.map((order) => (
                <div
                  key={order.id}
                  className="flex aspect-[8/3] flex-col items-center justify-center rounded-[18px] border-2 border-cyan-300/80 bg-slate-900/80 px-1 text-center shadow-[0_0_18px_rgba(46,242,255,0.34)]"
                >
                  <p className="text-[50px] font-black leading-none text-white neon-title">{order.num}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 rounded-[18px] border border-cyan-300/20 bg-slate-950/40 px-3 py-3 text-center text-sm text-slate-300">
              調理中の注文はありません
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
