"use client";

import { useEffect, useState, useCallback } from "react";
import { Order, OrderStatus, MenuItem } from "@/types";
import { fetchAllOrders, updateOrderStatus } from "@/lib/orders";
import { fetchMenuItems, updateMenuItem } from "@/lib/menu";
import { supabase } from "@/lib/supabase";
import OrderCard from "@/app/components/admin/OrderCard";

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "1234";

type AdminTab = "orders" | "menu";

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState<AdminTab>("orders");
  const [editingMenuId, setEditingMenuId] = useState<number | null>(null);
  const [editingPrice, setEditingPrice] = useState<string>("");
  const [now, setNow] = useState(() => Date.now());

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
      const [ordersData, menuData] = await Promise.all([fetchAllOrders(), fetchMenuItems()]);
      setOrders(ordersData);
      setMenu(menuData);
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

  useEffect(() => {
    if (!authed) return;

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [authed]);

  async function handleUpdate(id: string, status: OrderStatus) {
    setUpdating(id);
    try {
      await updateOrderStatus(id, status);
      await load();
    } finally {
      setUpdating(null);
    }
  }

  async function handleMenuUpdate(menuId: number) {
    const newPrice = parseInt(editingPrice, 10);
    if (isNaN(newPrice)) return;

    try {
      await updateMenuItem(menuId, { price: newPrice });
      setEditingMenuId(null);
      setEditingPrice("");
      await load();
    } catch {
      alert("更新に失敗しました");
    }
  }

  async function handleAvailableToggle(menuId: number, currentAvailable: boolean) {
    try {
      await updateMenuItem(menuId, { available: !currentAvailable });
      await load();
    } catch {
      alert("更新に失敗しました");
    }
  }

  if (!authed) {
    return (
      <main className="min-h-screen bg-white px-3 py-3">
        <div className="mx-auto flex min-h-[95vh] w-full max-w-md items-center justify-center rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="w-full rounded-3xl border border-slate-200 bg-white p-6">
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
    <main className="min-h-screen bg-slate-100 px-3 py-3">
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h1 className="neon-title text-2xl font-black">注文一覧</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setAdminTab("orders")}
              className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
                adminTab === "orders"
                  ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-100"
                  : "border-slate-300/30 text-slate-300"
              }`}
            >
              📋 注文管理
            </button>
            <button
              onClick={() => setAdminTab("menu")}
              className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
                adminTab === "menu"
                  ? "border-emerald-300/40 bg-emerald-300/15 text-emerald-100"
                  : "border-slate-300/30 text-slate-300"
              }`}
            >
              ⚙️ 商品管理
            </button>
            <button onClick={handleLogout} className="rounded-xl border border-fuchsia-300/40 px-3 py-2 text-sm font-bold text-fuchsia-100">
              ログアウト
            </button>
          </div>
        </div>

        {loading && <div className="py-16 text-center text-slate-300">読み込み中...</div>}

        {/* 注文管理タブ */}
        {adminTab === "orders" && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-slate-300">対応中の注文 {orders.length} 件</p>
              <button onClick={load} className="rounded-xl border border-cyan-300/40 px-3 py-2 text-sm font-bold text-cyan-100">
                更新
              </button>
            </div>

            {!loading && orders.length === 0 && (
              <div className="py-16 text-center text-slate-300">
                <p className="text-4xl">🎉</p>
                <p className="mt-2">注文はまだありません</p>
              </div>
            )}

            <div className="space-y-3">
              {[...orders].reverse().map((order) => (
                <OrderCard key={order.id} order={order} now={now} isUpdating={updating === order.id} onUpdate={handleUpdate} />
              ))}
            </div>
          </>
        )}

        {/* 商品管理タブ */}
        {adminTab === "menu" && (
          <div className="space-y-3">
            {menu.map((item) => (
              <article key={item.id} className={`rounded-2xl border p-4 transition ${
                !item.available ? "border-fuchsia-300/40 bg-fuchsia-300/10" : "border-cyan-300/25 bg-slate-900/65"
              }`}>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-base font-black text-white">
                      {item.emoji} {item.name}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAvailableToggle(item.id, item.available)}
                    className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                      item.available
                        ? "border-emerald-300/50 bg-emerald-300/15 text-emerald-100"
                        : "border-fuchsia-300/50 bg-fuchsia-300/15 text-fuchsia-100"
                    }`}
                  >
                    {item.available ? "販売中" : "SOLDOUT"}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-300">価格:</span>
                  {editingMenuId === item.id ? (
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={editingPrice}
                        onChange={(e) => setEditingPrice(e.target.value)}
                        className="w-20 rounded-lg border border-cyan-300/40 bg-slate-950/70 px-2 py-1 text-sm text-cyan-100 outline-none"
                        autoFocus
                      />
                      <button
                        onClick={() => handleMenuUpdate(item.id)}
                        className="rounded-lg border border-emerald-300/40 bg-emerald-300/15 px-3 py-1 text-sm font-bold text-emerald-100"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setEditingMenuId(null)}
                        className="rounded-lg border border-slate-300/40 px-3 py-1 text-sm font-bold text-slate-300"
                      >
                        キャンセル
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-cyan-200">¥{item.price}</span>
                      <button
                        onClick={() => {
                          setEditingMenuId(item.id);
                          setEditingPrice(item.price.toString());
                        }}
                        className="rounded-lg border border-cyan-300/40 bg-cyan-300/15 px-3 py-1 text-sm font-bold text-cyan-100"
                      >
                        編集
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
