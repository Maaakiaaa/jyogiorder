"use client";

import { useCallback, useEffect, useState } from "react";
import { Order, OrderStatus } from "@/types";
import { fetchActiveOrders, updateOrderStatus } from "@/lib/orders";
import { supabase } from "@/lib/supabase";
import OrderCard from "@/app/components/kitchen/OrderCard";

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const data = await fetchActiveOrders();
      setOrders(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    const channel = supabase
      .channel("kitchen-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();

    // 購読の再接続だけに頼らず、画面が前面に戻った時にも現在状態を取り直す(保険)。
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    const poll = setInterval(load, 15000);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(poll);
    };
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function transition(id: string, status: OrderStatus) {
    setUpdating(id);
    try {
      await updateOrderStatus(id, status);
      await load();
    } finally {
      setUpdating(null);
    }
  }

  function handleAdvance(id: string) {
    const order = orders.find((o) => o.id === id);
    if (!order) return;
    const next: OrderStatus = order.status === "received" ? "cooking" : "ready";
    void transition(id, next);
  }

  function handleBack(id: string) {
    void transition(id, "received");
  }

  function handleCancel(id: string) {
    void transition(id, "cancelled");
  }

  const kitchenOrders = orders.filter((o) => o.status === "received" || o.status === "cooking");

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-3">
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="neon-title text-2xl font-black">調理ディスプレイ</h1>
          <button onClick={load} className="rounded-xl border border-cyan-300/40 px-3 py-2 text-sm font-bold text-cyan-100">
            更新
          </button>
        </div>

        <p className="mb-3 text-sm text-slate-500">対応中の注文 {kitchenOrders.length} 件</p>

        {loading && <div className="py-16 text-center text-slate-400">読み込み中...</div>}

        {!loading && kitchenOrders.length === 0 && (
          <div className="py-16 text-center text-slate-400">
            <p className="text-4xl">🍳</p>
            <p className="mt-2">作る注文はまだありません</p>
          </div>
        )}

        <div className="space-y-3">
          {kitchenOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              now={now}
              isUpdating={updating === order.id}
              onAdvance={handleAdvance}
              onBack={handleBack}
              onCancel={handleCancel}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
