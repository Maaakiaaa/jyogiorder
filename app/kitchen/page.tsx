"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MenuItem, Order, OrderStatus, YakitoriType } from "@/types";
import { fetchActiveOrders, fetchRecentCancelledOrders, updateOrderStatus } from "@/lib/orders";
import { fetchMenuItems, fetchYakitoriTypes, setItemAvailable, setOptionAvailable, setYakitoriTypeAvailable } from "@/lib/menu";
import { createNotificationAudio, playNotificationAudio, unlockNotificationAudio } from "@/lib/notificationSound";
import { supabase } from "@/lib/supabase";
import OrderCard from "@/app/components/kitchen/OrderCard";
import RoleGate from "@/app/components/auth/RoleGate";

function KitchenContent() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [cancelledOrders, setCancelledOrders] = useState<Order[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [yakitoriTypes, setYakitoriTypes] = useState<YakitoriType[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [audioEnabled, setAudioEnabled] = useState(false);
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const previousOrderIdsRef = useRef<Set<string>>(new Set());
  const hasLoadedOrdersRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const [active, cancelled, menuItems, types] = await Promise.all([fetchActiveOrders(), fetchRecentCancelledOrders(), fetchMenuItems(), fetchYakitoriTypes()]);
      if (!hasLoadedOrdersRef.current) {
        previousOrderIdsRef.current = new Set(active.map((order) => order.id));
        hasLoadedOrdersRef.current = true;
      }
      setOrders(active);
      setCancelledOrders(cancelled);
      setMenu(menuItems);
      setYakitoriTypes(types);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    notificationAudioRef.current = createNotificationAudio();
    return () => {
      notificationAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const currentOrderIds = new Set(orders.map((order) => order.id));
    const hasNewOrder = orders.some((order) => !previousOrderIdsRef.current.has(order.id));
    previousOrderIdsRef.current = currentOrderIds;
    if (!hasNewOrder || !audioEnabled) return;

    const audio = notificationAudioRef.current;
    if (audio) playNotificationAudio(audio);
  }, [audioEnabled, orders]);

  useEffect(() => {
    load();

    const channel = supabase
      .channel("kitchen-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "options" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "yakitori_types" }, () => load())
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

  async function toggleItem(item: MenuItem) {
    setUpdating(`item-${item.id}`);
    try {
      await setItemAvailable(item.id, !item.isAvailable);
      await load();
    } catch (error) {
      alert(`品目の切り替えに失敗しました: ${error instanceof Error ? error.message : "権限または通信エラー"}`);
    } finally {
      setUpdating(null);
    }
  }

  async function toggleOption(optionId: number, available: boolean) {
    setUpdating(`option-${optionId}`);
    try {
      await setOptionAvailable(optionId, !available);
      await load();
    } catch (error) {
      alert(`選択肢の切り替えに失敗しました: ${error instanceof Error ? error.message : "権限または通信エラー"}`);
    } finally {
      setUpdating(null);
    }
  }

  async function toggleYakitoriType(typeId: number, available: boolean) {
    setUpdating(`yakitori-type-${typeId}`);
    try {
      await setYakitoriTypeAvailable(typeId, !available);
      await load();
    } catch (error) {
      alert(`焼き鳥種類の切り替えに失敗しました: ${error instanceof Error ? error.message : "権限または通信エラー"}`);
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

  function handleRestore(id: string) {
    void transition(id, "received");
  }

  async function enableAudio() {
    setAudioEnabled(true);
    const audio = notificationAudioRef.current;
    if (audio) await unlockNotificationAudio(audio);
  }

  const kitchenOrders = orders.filter((o) => o.status === "received" || o.status === "cooking");

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-3">
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="neon-title text-2xl text-ink">調理ディスプレイ</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void enableAudio()}
              className={`rounded-xl border px-3 py-2 text-xs font-bold ${
                audioEnabled ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-brand-vermilion bg-brand-vermilion/10 text-brand-vermilion"
              }`}
            >
              {audioEnabled ? "🔊 音 ON" : "🔇 音を有効にする"}
            </button>
            <button onClick={load} className="rounded-xl border border-line px-3 py-2 text-sm font-bold text-brand-indigo">
              更新
            </button>
          </div>
        </div>

        {!audioEnabled && <p className="mb-3 rounded-xl border border-brand-vermilion/40 bg-brand-vermilion/10 px-3 py-2 text-xs font-bold text-brand-vermilion">音を有効にするまで新規注文の通知音は鳴りません</p>}

        <p className="mb-3 text-sm text-slate-500">対応中の注文 {kitchenOrders.length} 件</p>

        <section className="mb-5 rounded-2xl border-2 border-brand-vermilion/30 bg-brand-vermilion/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-ink">販売状態</h2>
              <p className="mt-1 text-xs text-sub">大きなトグルで品目・選択肢・焼き鳥の種類の売切れを切り替えます。</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-brand-vermilion">厨房権限</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {menu.map((item) => (
              <div key={item.id} className="rounded-xl border border-line bg-white p-3">
                <button
                  type="button"
                  onClick={() => void toggleItem(item)}
                  disabled={updating !== null}
                  className={`flex min-h-14 w-full items-center justify-between rounded-xl border-2 px-4 text-left font-black transition disabled:opacity-50 ${item.isAvailable ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-brand-vermilion bg-brand-vermilion/10 text-brand-vermilion"}`}
                >
                  <span>{item.emoji ? `${item.emoji} ` : ""}{item.name}</span>
                  <span>{item.isAvailable ? "販売中" : "売切れ"}</span>
                </button>
                {item.optionGroups.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {item.optionGroups.flatMap((group) => group.options.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => void toggleOption(option.id, option.isAvailable)}
                        disabled={updating !== null}
                        className={`flex min-h-11 w-full items-center justify-between rounded-lg border px-3 text-xs font-bold disabled:opacity-50 ${option.isAvailable ? "border-emerald-300 bg-emerald-50/50 text-emerald-800" : "border-brand-vermilion bg-brand-vermilion/10 text-brand-vermilion"}`}
                      >
                        <span>{group.name}: {option.name}</span>
                        <span>{option.isAvailable ? "販売中" : "売切れ"}</span>
                      </button>
                    )))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {yakitoriTypes.length > 0 && (
            <div className="mt-3 rounded-xl border border-brand-gold/40 bg-brand-gold/5 p-3">
              <p className="text-sm font-black text-ink">焼き鳥の種類</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {yakitoriTypes.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => void toggleYakitoriType(type.id, type.isAvailable)}
                    disabled={updating !== null || !type.isActive}
                    className={`flex min-h-11 items-center justify-between rounded-xl border-2 px-3 text-left text-sm font-black transition disabled:opacity-50 ${
                      type.isAvailable
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                        : "border-brand-vermilion bg-brand-vermilion/10 text-brand-vermilion"
                    }`}
                  >
                    <span>{type.name}</span>
                    <span>{type.isAvailable ? "販売中" : "売切れ"}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

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

        {cancelledOrders.length > 0 && (
          <div className="mt-6">
            <p className="mb-3 text-sm font-bold text-slate-500">取消済み（誤タップの場合はここから戻せます）</p>
            <div className="space-y-2">
              {cancelledOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-xl border border-brand-vermilion/30 bg-brand-vermilion/5 px-4 py-3"
                >
                  <div>
                    <p className="text-base font-black text-ink">番号 {order.number}</p>
                    <p className="text-sm text-[#AF011C]">{order.items.map((i) => `${i.name} x ${i.qty}`).join("、")}</p>
                  </div>
                  <button
                    disabled={updating === order.id}
                    onClick={() => handleRestore(order.id)}
                    className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-brand-indigo disabled:opacity-40"
                  >
                    {updating === order.id ? "..." : "取消を戻す"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function KitchenPage() {
  return <RoleGate roles={["staff", "admin"]}><KitchenContent /></RoleGate>;
}
