"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchMenuItems } from "@/lib/menu";
import { NewOrderItem, placeOrder } from "@/lib/orders";
import { peekNextNumber } from "@/lib/numbering";
import { createOrderId } from "@/lib/qr";
import { usePendingSync } from "@/app/components/pos/usePendingSync";
import { MenuItem, Order } from "@/types";

type BCartItem = {
  menuItem: MenuItem;
  qty: number;
};

export default function PosBPage() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<BCartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [nextNumber, setNextNumber] = useState("-");
  const pendingSyncCount = usePendingSync();

  useEffect(() => {
    fetchMenuItems()
      .then((items) => setMenu(items))
      .catch(() => setError("メニュー情報の取得に失敗しました"));
  }, []);

  useEffect(() => {
    setNextNumber(peekNextNumber("B"));
  }, [confirmedOrder]);

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.menuItem.price * item.qty, 0),
    [cart]
  );

  function addItem(menuItem: MenuItem) {
    setConfirmedOrder(null);
    setCart((prev) => {
      const existing = prev.find((item) => item.menuItem.id === menuItem.id);
      if (existing) {
        return prev.map((item) =>
          item.menuItem.id === menuItem.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { menuItem, qty: 1 }];
    });
  }

  function changeQty(menuItemId: number, delta: number) {
    setCart((prev) =>
      prev
        .map((item) => (item.menuItem.id === menuItemId ? { ...item, qty: item.qty + delta } : item))
        .filter((item) => item.qty > 0)
    );
  }

  async function handleCheckout() {
    if (cart.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setError("");
    try {
      const items: NewOrderItem[] = cart.map((item) => ({
        menuItemId: item.menuItem.id,
        name: item.menuItem.name,
        price: item.menuItem.price,
        qty: item.qty,
      }));
      const order = await placeOrder(createOrderId(), "B", items);
      setConfirmedOrder(order);
      setCart([]);
    } catch {
      setError("番号発行に失敗しました。もう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="festival-bg min-h-screen px-3 py-3">
      <div className="glass-panel relative z-10 mx-auto flex min-h-[95vh] w-full max-w-md flex-col rounded-[28px] p-4">
        <header className="border-b border-line pb-4">
          <p className="neon-title text-[11px] uppercase tracking-[0.22em] text-sub">
            POS · B
          </p>
          <h1 className="neon-title mt-2 text-2xl text-ink">B端末（店頭）</h1>
          <p className="mt-2 text-sm text-sub">その場で品目を選び、会計と同時に番号を発行します。</p>
          <p className="mt-1 text-xs text-sub">次に発行される番号: {nextNumber}</p>
          {pendingSyncCount > 0 && (
            <p className="mt-2 rounded-lg border border-brand-gold/40 bg-brand-gold/10 px-3 py-1.5 text-xs font-bold text-brand-gold">
              オフライン: 同期待ち {pendingSyncCount}件（このまま操作を続けてください。復帰次第自動送信します）
            </p>
          )}
        </header>

        {error && (
          <div className="mt-4 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {confirmedOrder && (
          <section className="mt-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-700">
              会計完了・番号発行
            </p>
            <p className="mt-2 text-5xl font-black text-ink">{confirmedOrder.number}</p>
            <p className="mt-2 text-sm text-emerald-700">紙の番号札を渡してください。</p>
          </section>
        )}

        <section className="mt-4 rounded-2xl border border-line bg-canvas p-4">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-sub">メニュー</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {menu.map((item) => (
              <button
                key={item.id}
                onClick={() => addItem(item)}
                disabled={!item.isAvailable}
                className="rounded-xl border border-line bg-surface px-3 py-3 text-left text-sm text-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="block font-bold">
                  {item.emoji ? `${item.emoji} ` : ""}{item.name}
                  {!item.isAvailable && <span className="ml-1 text-xs text-brand-vermilion">SOLDOUT</span>}
                </span>
                <span className="mt-1 block text-xs text-sub">¥{item.price}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-4 flex-1 rounded-2xl border border-line bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-sub">会計内容</p>
            <p className="text-sm font-black text-ink">¥{total.toLocaleString()}</p>
          </div>

          {cart.length > 0 ? (
            <div className="space-y-2">
              {cart.map((item) => (
                <div key={item.menuItem.id} className="flex items-center justify-between text-sm text-ink">
                  <span>{item.menuItem.name}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => changeQty(item.menuItem.id, -1)}
                      className="h-7 w-7 rounded-full border border-line text-brand-indigo"
                    >
                      −
                    </button>
                    <span className="w-6 text-center">{item.qty}</span>
                    <button
                      onClick={() => changeQty(item.menuItem.id, 1)}
                      className="h-7 w-7 rounded-full border border-line text-brand-indigo"
                    >
                      +
                    </button>
                    <span className="ml-2 w-16 text-right">¥{(item.menuItem.price * item.qty).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-line bg-canvas px-3 py-6 text-center text-sm text-sub">
              メニューをタップして追加してください
            </div>
          )}

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || isSubmitting}
            className="neon-button mt-4 w-full rounded-2xl px-4 py-4 text-base font-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "発行中..." : "会計・番号発行"}
          </button>
        </section>
      </div>
    </main>
  );
}
