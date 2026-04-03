"use client";

import { useEffect, useState, useCallback } from "react";
import { Order, OrderStatus } from "@/types";
import { fetchAllOrders, updateOrderStatus } from "@/lib/orders";
import { supabase } from "@/lib/supabase";

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "1234";

const STATUS_LABEL: Record<OrderStatus, string> = {
  waiting: "待機中",
  ready: "受取可能",
  done: "受取完了",
};

const STATUS_CLASS: Record<OrderStatus, string> = {
  waiting: "text-yellow-200 border-yellow-300/40",
  ready: "text-cyan-200 border-cyan-300/40",
  done: "text-fuchsia-200 border-fuchsia-300/40",
};

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem("admin_authed") === "true") {
      setAuthed(true);
    }
  }, []);

  function handleLogin() {
    if (input === ADMIN_PASSWORD) {
      sessionStorage.setItem("admin_authed", "true");
      setAuthed(true);
      setError(false);
    } else {
      setError(true);
      setInput("");
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("admin_authed");
    setAuthed(false);
    setInput("");
  }

  const load = useCallback(async () => {
    try {
      const data = await fetchAllOrders();
      setOrders(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    load();

    const channel = supabase
      .channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authed, load]);

  async function handleUpdate(id: string, status: OrderStatus) {
    setUpdating(id);
    try {
      await updateOrderStatus(id, status);
      await load();
    } finally {
      setUpdating(null);
    }
  }

  if (!authed) {
    return (
      <main className="festival-bg min-h-screen px-3 py-3">
        <div className="relative z-10 mx-auto flex min-h-[95vh] w-full max-w-md items-center justify-center rounded-[28px] glass-panel p-5">
          <div className="w-full rounded-3xl border border-cyan-300/35 bg-slate-900/65 p-6">
            <p className="text-center text-4xl">🔐</p>
            <h1 className="neon-title mt-2 text-center text-2xl font-black">ADMIN LOGIN</h1>
            <p className="mt-2 text-center text-xs text-slate-300">管理パスワードを入力してください</p>

            <input
              type="password"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="Password"
              className={`mt-5 w-full rounded-xl border bg-slate-950/70 px-4 py-3 text-sm outline-none ${
                error ? "border-rose-300/70 text-rose-100" : "border-cyan-300/40 text-cyan-100"
              }`}
              autoFocus
            />

            {error && <p className="mt-2 text-center text-xs text-rose-300">パスワードが違います</p>}

            <button onClick={handleLogin} className="neon-button mt-5 w-full rounded-xl py-4 text-base font-black">
              ログイン
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="festival-bg min-h-screen px-3 py-3">
      <div className="relative z-10 mx-auto w-full max-w-2xl rounded-[28px] glass-panel p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="neon-title text-2xl font-black">ADMIN PANEL</h1>
            <p className="mt-1 text-sm text-slate-300">対応中の注文 {orders.length} 件</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="rounded-xl border border-cyan-300/40 px-3 py-3 text-sm font-bold text-cyan-100">
              更新
            </button>
            <button onClick={handleLogout} className="rounded-xl border border-fuchsia-300/40 px-3 py-3 text-sm font-bold text-fuchsia-100">
              ログアウト
            </button>
          </div>
        </div>

        {loading && <div className="py-16 text-center text-slate-300">読み込み中...</div>}

        {!loading && orders.length === 0 && (
          <div className="py-16 text-center text-slate-300">
            <p className="text-4xl">🎉</p>
            <p className="mt-2">注文はまだありません</p>
          </div>
        )}

        <div className="space-y-3">
          {[...orders].reverse().map((order) => {
            const itemsText = order.items.map((i) => `${i.name} x ${i.qty}`).join("、");
            const isUpdating = updating === order.id;

            return (
              <article key={order.id} className="rounded-2xl border border-cyan-300/25 bg-slate-900/65 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-lg font-black text-white">番号 {order.num}</span>
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${STATUS_CLASS[order.status]}`}>
                    {STATUS_LABEL[order.status]}
                  </span>
                </div>
                <p className="text-sm text-slate-300">{itemsText}</p>
                <p className="mb-3 mt-1 text-sm font-black text-cyan-200">¥{order.total.toLocaleString()}</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled={order.status !== "waiting" || isUpdating}
                    onClick={() => handleUpdate(order.id, "ready")}
                    className="rounded-xl border border-cyan-300/40 bg-cyan-300/15 py-3 text-sm font-black text-cyan-100 disabled:opacity-35"
                  >
                    {isUpdating ? "..." : "受け取り可能"}
                  </button>
                  <button
                    disabled={order.status !== "ready" || isUpdating}
                    onClick={() => handleUpdate(order.id, "done")}
                    className="rounded-xl border border-fuchsia-300/40 bg-fuchsia-300/15 py-3 text-sm font-black text-fuchsia-100 disabled:opacity-35"
                  >
                    {isUpdating ? "..." : "受け取り完了"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
