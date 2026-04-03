"use client";

import { useEffect, useState, useCallback } from "react";
import { Order } from "@/types";
import { fetchAllOrders } from "@/lib/orders";
import { supabase } from "@/lib/supabase";

export default function DisplayPage() {
  const [orders, setOrders] = useState<Order[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await fetchAllOrders();
      setOrders(data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("display-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const readyOrders = orders.filter((o) => o.status === "ready");
  const waitingOrders = orders.filter((o) => o.status === "waiting");

  return (
    <main className="festival-bg min-h-screen px-3 py-3">
      <div className="relative z-10 mx-auto min-h-[95vh] w-full max-w-5xl rounded-[28px] glass-panel p-6">
        <header className="mb-6 flex items-center justify-between border-b border-cyan-300/25 pb-4">
          <h1 className="neon-title text-3xl font-black">CALL BOARD</h1>
          <p className="text-sm text-slate-300">文化祭オーダー呼出画面</p>
        </header>

        {orders.length === 0 && (
          <div className="flex min-h-[70vh] flex-col items-center justify-center text-slate-300">
            <p className="text-6xl">🎪</p>
            <p className="mt-4 text-xl font-bold">注文が入ると表示されます</p>
          </div>
        )}

        {readyOrders.length > 0 && (
          <section className="mb-8">
            <p className="mb-4 text-lg font-black text-cyan-200 neon-title">READY NOW</p>
            <div className="flex flex-wrap gap-4">
              {readyOrders.map((o) => (
                <div key={o.id} className="animate-bounce-in flex h-32 w-32 flex-col items-center justify-center rounded-3xl border border-cyan-300/50 bg-cyan-300/15 text-cyan-100 shadow-[0_0_24px_rgba(46,242,255,0.5)]">
                  <span className="text-5xl font-black">{o.num}</span>
                  <span className="mt-1 text-xs font-bold uppercase tracking-[0.2em]">Ready</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {waitingOrders.length > 0 && (
          <section>
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-slate-300">Cooking</p>
            <div className="flex flex-wrap gap-3">
              {waitingOrders.map((o) => (
                <div key={o.id} className="flex h-20 w-20 flex-col items-center justify-center rounded-2xl border border-fuchsia-300/35 bg-fuchsia-300/10 text-fuchsia-100">
                  <span className="text-3xl font-black">{o.num}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
