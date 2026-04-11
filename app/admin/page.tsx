"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Order, OrderStatus, MenuItem } from "@/types";
import { fetchAllOrders, fetchSalesOrders, updateOrderStatus } from "@/lib/orders";
import { createMenuItem, fetchMenuItems, updateMenuItem } from "@/lib/menu";
import { supabase } from "@/lib/supabase";
import OrderCard from "@/app/components/admin/OrderCard";

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "1234";

type AdminTab = "orders" | "menu" | "sales";

type ProductSales = {
  name: string;
  qty: number;
  amount: number;
};

function getErrorMessage(error: unknown) {
  if (typeof error === "string") return error;

  if (error && typeof error === "object") {
    const candidate = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };

    const parts = [candidate.message, candidate.details, candidate.hint, candidate.code]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0);

    if (parts.length > 0) return parts.join(" / ");
  }

  return "不明なエラー";
}

export default function AdminPage() {
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const previousSalesOrderIdsRef = useRef<Set<string>>(new Set());
  const hasInitializedSalesRef = useRef(false);
  const [authed, setAuthed] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [salesOrders, setSalesOrders] = useState<Order[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState<AdminTab>("orders");
  const [editingMenuId, setEditingMenuId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [editingPrice, setEditingPrice] = useState<string>("");
  const [newMenuName, setNewMenuName] = useState("");
  const [newMenuPrice, setNewMenuPrice] = useState("");
  const [isCreateMenuFormOpen, setIsCreateMenuFormOpen] = useState(false);
  const [isCreatingMenuItem, setIsCreatingMenuItem] = useState(false);
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
      const [ordersData, menuData, salesOrderData] = await Promise.all([fetchAllOrders(), fetchMenuItems(), fetchSalesOrders()]);
      setOrders(ordersData);
      setMenu(menuData);
      setSalesOrders(salesOrderData);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const productSales = useMemo<ProductSales[]>(() => {
    const salesMap = new Map<string, ProductSales>();

    for (const item of menu) {
      salesMap.set(item.name, { name: item.name, qty: 0, amount: 0 });
    }

    for (const order of salesOrders) {
      for (const item of order.items) {
        const current = salesMap.get(item.name) ?? { name: item.name, qty: 0, amount: 0 };
        current.qty += item.qty;
        current.amount += item.qty * item.price;
        salesMap.set(item.name, current);
      }
    }

    return Array.from(salesMap.values()).sort((a, b) => b.qty - a.qty || b.amount - a.amount || a.name.localeCompare(b.name, "ja"));
  }, [menu, salesOrders]);

  const totalSoldCount = useMemo(
    () => productSales.reduce((sum, item) => sum + item.qty, 0),
    [productSales]
  );

  const totalSalesAmount = useMemo(
    () => productSales.reduce((sum, item) => sum + item.amount, 0),
    [productSales]
  );

  useEffect(() => {
    if (!authed) return;

    notificationAudioRef.current = new Audio("/Bell.mp3");
    notificationAudioRef.current.preload = "auto";

    return () => {
      notificationAudioRef.current = null;
    };
  }, [authed]);

  useEffect(() => {
    if (!authed || loading) return;

    const currentIds = new Set(salesOrders.map((order) => order.id));

    if (!hasInitializedSalesRef.current) {
      previousSalesOrderIdsRef.current = currentIds;
      hasInitializedSalesRef.current = true;
      return;
    }

    const hasNewOrder = salesOrders.some((order) => !previousSalesOrderIdsRef.current.has(order.id));
    previousSalesOrderIdsRef.current = currentIds;

    if (!hasNewOrder) return;

    const audio = notificationAudioRef.current;
    if (!audio) return;

    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Browser autoplay policies may block playback until the user interacts.
    });
  }, [authed, loading, salesOrders]);

  useEffect(() => {
    if (authed) return;

    previousSalesOrderIdsRef.current = new Set();
    hasInitializedSalesRef.current = false;
  }, [authed]);

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
    const newName = editingName.trim();
    const newPrice = parseInt(editingPrice, 10);
    if (!newName || isNaN(newPrice)) return;

    try {
      await updateMenuItem(menuId, { name: newName, price: newPrice });
      clearMenuEditing();
      await load();
    } catch (error) {
      alert(`更新に失敗しました: ${getErrorMessage(error)}`);
    }
  }

  async function handleCreateMenuItem() {
    const name = newMenuName.trim();
    const price = parseInt(newMenuPrice, 10);

    if (!name || isNaN(price)) {
      alert("商品名・価格を入力してください");
      return;
    }

    setIsCreatingMenuItem(true);
    try {
      await createMenuItem({
        name,
        price,
        available: true,
      });
      setNewMenuName("");
      setNewMenuPrice("");
      setIsCreateMenuFormOpen(false);
      await load();
    } catch (error) {
      console.error("Create menu item error:", error);
      alert(`追加に失敗しました: ${getErrorMessage(error)}`);
    } finally {
      setIsCreatingMenuItem(false);
    }
  }

  function startMenuEditing(item: MenuItem) {
    setEditingMenuId(item.id);
    setEditingName(item.name);
    setEditingPrice(item.price.toString());
  }

  function clearMenuEditing() {
    setEditingMenuId(null);
    setEditingName("");
    setEditingPrice("");
  }

  async function handleAvailableToggle(menuId: number, currentAvailable: boolean) {
    try {
      await updateMenuItem(menuId, { available: !currentAvailable });
      await load();
    } catch (error) {
      alert(`更新に失敗しました: ${getErrorMessage(error)}`);
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
            <button
              onClick={() => setAdminTab("sales")}
              className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
                adminTab === "sales"
                  ? "border-yellow-300/40 bg-yellow-300/15 text-yellow-100"
                  : "border-slate-300/30 text-slate-300"
              }`}
            >
              📈 販売実績
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

        {/* 販売実績タブ */}
        {adminTab === "sales" && (
          <div className="space-y-3">
            <section className="rounded-2xl border border-cyan-300/25 bg-slate-900/65 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-base font-black text-white">販売実績</p>
                <p className="text-xs font-bold text-cyan-200">
                  {totalSoldCount}個 / ¥{totalSalesAmount.toLocaleString()}
                </p>
              </div>

              <div className="space-y-2">
                {productSales.length > 0 ? (
                  productSales.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between rounded-xl border border-cyan-300/20 bg-slate-950/55 px-3 py-2"
                    >
                      <p className="text-sm font-bold text-white">{item.name}</p>
                      <div className="text-right">
                        <p className="text-sm font-black text-cyan-100">{item.qty}個</p>
                        <p className="text-xs text-slate-300">¥{item.amount.toLocaleString()}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-cyan-300/20 bg-slate-950/55 px-3 py-4 text-center text-sm text-slate-300">
                    まだ販売実績はありません
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* 商品管理タブ */}
        {adminTab === "menu" && (
          <div className="space-y-3">
            <section className="rounded-2xl border border-emerald-300/30 bg-slate-900/65 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-base font-black text-white">新しい商品を追加</p>
                <button
                  onClick={() => setIsCreateMenuFormOpen((prev) => !prev)}
                  className="rounded-lg border border-emerald-300/40 bg-emerald-300/15 px-4 py-2 text-sm font-bold text-emerald-100"
                >
                  {isCreateMenuFormOpen ? "閉じる" : "商品を追加する"}
                </button>
              </div>

              {isCreateMenuFormOpen && (
                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_110px_auto_auto]">
                  <input
                    type="text"
                    value={newMenuName}
                    onChange={(e) => setNewMenuName(e.target.value)}
                    placeholder="商品名"
                    className="rounded-lg border border-cyan-300/40 bg-slate-950/70 px-3 py-2 text-sm text-cyan-100 outline-none"
                    autoFocus
                  />
                  <input
                    type="number"
                    value={newMenuPrice}
                    onChange={(e) => setNewMenuPrice(e.target.value)}
                    placeholder="価格"
                    className="rounded-lg border border-cyan-300/40 bg-slate-950/70 px-3 py-2 text-sm text-cyan-100 outline-none"
                  />
                  <button
                    onClick={handleCreateMenuItem}
                    disabled={isCreatingMenuItem}
                    className="rounded-lg border border-emerald-300/40 bg-emerald-300/15 px-4 py-2 text-sm font-bold text-emerald-100 disabled:opacity-50"
                  >
                    {isCreatingMenuItem ? "追加中..." : "追加"}
                  </button>
                  <button
                    onClick={() => {
                      setIsCreateMenuFormOpen(false);
                      setNewMenuName("");
                      setNewMenuPrice("");
                    }}
                    className="rounded-lg border border-slate-300/40 px-4 py-2 text-sm font-bold text-slate-300"
                  >
                    キャンセル
                  </button>
                </div>
              )}
            </section>
            {menu.map((item) => (
              <article key={item.id} className={`rounded-2xl border p-4 transition ${
                !item.available ? "border-fuchsia-300/40 bg-fuchsia-300/10" : "border-cyan-300/25 bg-slate-900/65"
              }`}>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    {editingMenuId === item.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="rounded-lg border border-cyan-300/40 bg-slate-950/70 px-3 py-1.5 text-sm font-bold text-cyan-100 outline-none"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <p className="text-base font-black text-white">
                        {item.emoji ? `${item.emoji} ` : ""}{item.name}
                      </p>
                    )}
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
                      />
                      <button
                        onClick={() => handleMenuUpdate(item.id)}
                        className="rounded-lg border border-emerald-300/40 bg-emerald-300/15 px-3 py-1 text-sm font-bold text-emerald-100"
                      >
                        保存
                      </button>
                      <button
                        onClick={clearMenuEditing}
                        className="rounded-lg border border-slate-300/40 px-3 py-1 text-sm font-bold text-slate-300"
                      >
                        キャンセル
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-cyan-200">¥{item.price}</span>
                      <button
                        onClick={() => startMenuEditing(item)}
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
