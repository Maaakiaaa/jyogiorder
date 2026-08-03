"use client";

import { useCallback, useEffect, useState } from "react";
import { Order } from "@/types";
import { fetchActiveOrders, updateOrderStatus } from "@/lib/orders";
import { supabase } from "@/lib/supabase";

export default function BoardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchActiveOrders();
      setOrders(data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    load();

    const channel = supabase
      .channel("board-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    const poll = setInterval(load, 5000);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(poll);
    };
  }, [load]);

  async function handleHandOver(id: string) {
    setUpdating(id);
    try {
      await updateOrderStatus(id, "handed");
      await load();
    } finally {
      setUpdating(null);
    }
  }

  // 受け取り可能: 完了(呼び出し中)かつ未受け渡し。受け取り待ち: 受付/調理中で、まだ呼ばれていない。
  const readyOrders = orders.filter((o) => o.status === "ready");
  const waitingOrders = orders.filter((o) => o.status === "received" || o.status === "cooking");

  return (
    <main className="festival-bg min-h-screen px-3 py-3">
      <div className="relative z-10 mx-auto flex min-h-[88vh] w-full max-w-md flex-col gap-3 overflow-hidden rounded-[28px] glass-panel p-4">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-24px] top-8 h-40 w-40 rounded-full bg-fuchsia-500/15 blur-3xl" />
          <div className="absolute right-[-28px] top-36 h-44 w-44 rounded-full bg-cyan-400/12 blur-3xl" />
        </div>

        <header className="relative z-10 text-center">
          <p className="text-sm font-black tracking-[0.3em] text-white neon-title">呼び出しボード</p>
        </header>

        {readyOrders.length === 0 && waitingOrders.length === 0 && (
          <div className="relative z-10 flex min-h-[70vh] flex-col items-center justify-center rounded-[28px] border border-white/10 bg-slate-950/60 text-slate-300">
            <p className="text-6xl">🎪</p>
            <p className="mt-4 text-xl font-bold">注文が入ると表示されます</p>
          </div>
        )}

        {readyOrders.length > 0 && (
          <section className="relative z-10 rounded-[34px] border-[4px] border-emerald-400/80 bg-slate-950/70 px-4 py-4 shadow-[0_0_36px_rgba(34,197,94,0.54)]">
            <p className="text-center text-[25px] font-bold uppercase tracking-[0.3em] text-emerald-200/90">READY</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {readyOrders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => handleHandOver(order.id)}
                  disabled={updating === order.id}
                  className="flex aspect-[6/5] flex-col items-center justify-center gap-1 rounded-[18px] border-2 border-emerald-300/80 bg-slate-900/80 px-1 text-center shadow-[0_0_18px_rgba(34,197,94,0.34)] disabled:opacity-50"
                >
                  <p className="text-[42px] font-black leading-none text-white neon-title">{order.number}</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200/80">
                    {updating === order.id ? "..." : "タップでお渡し完了"}
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}

        {waitingOrders.length > 0 && (
          <section className="relative z-10 rounded-[26px] border border-cyan-300/25 bg-slate-950/55 px-3 py-2.5 shadow-[0_0_20px_rgba(46,242,255,0.14)]">
            <p className="text-center text-sm font-black text-white neon-title">受け取り待ち</p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {waitingOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex aspect-[8/3] flex-col items-center justify-center rounded-[18px] border-2 border-cyan-300/80 bg-slate-900/80 px-1 text-center shadow-[0_0_18px_rgba(46,242,255,0.34)]"
                >
                  <p className="text-[36px] font-black leading-none text-white neon-title">{order.number}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
