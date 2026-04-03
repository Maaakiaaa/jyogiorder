"use client";

import { useState } from "react";
import MenuPanel from "@/app/components/costomers/MenuPanel";
import CartPanel from "@/app/components/costomers/CartPanel";
import WaitingPanel from "@/app/components/costomers/WaitingPanel";
import WelcomePanel from "@/app/components/costomers/WelcomePanel";
import { CartItem, Order } from "@/types";
import { createOrder } from "@/lib/orders";
import { MENU_ITEMS } from "@/lib/menu";

type CustomerStep = "menu" | "waiting" | "welcome";
type TabType = "menu" | "cart";

export default function CustomerPage() {
  const [step, setStep] = useState<CustomerStep>("menu");
  const [activeTab, setActiveTab] = useState<TabType>("menu");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [placing, setPlacing] = useState(false);

  const cartTotal = cart.reduce((s, i) => s + i.menuItem.price * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  function changeQty(id: number, delta: number) {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItem.id === id);
      const menuItem = MENU_ITEMS.find((m) => m.id === id)!;
      if (!existing) {
        if (delta <= 0) return prev;
        return [...prev, { menuItem, qty: 1 }];
      }
      const newQty = existing.qty + delta;
      if (newQty <= 0) return prev.filter((c) => c.menuItem.id !== id);
      return prev.map((c) => (c.menuItem.id === id ? { ...c, qty: newQty } : c));
    });
  }

  async function handlePlaceOrder() {
    if (cart.length === 0 || placing) return;
    setPlacing(true);
    try {
      const items = cart.map((c) => ({
        name: c.menuItem.name,
        qty: c.qty,
        price: c.menuItem.price,
      }));
      const newOrder = await createOrder(items);
      setOrder(newOrder);
      setCart([]);
      setStep("waiting");
    } catch {
      alert("注文に失敗しました。もう一度お試しください。");
    } finally {
      setPlacing(false);
    }
  }

  function handleDone() {
    setStep("welcome");
  }

  function handleReset() {
    setStep("menu");
    setActiveTab("menu");
    setOrder(null);
  }

  if (step === "waiting" && order) {
    return <WaitingPanel order={order} onDone={handleDone} />;
  }
  if (step === "welcome") {
    return <WelcomePanel onReset={handleReset} />;
  }

  return (
    <main className="festival-bg min-h-screen px-3 py-3">
      <div className="relative z-10 mx-auto flex min-h-[95vh] w-full max-w-md flex-col overflow-hidden rounded-[28px] glass-panel">
        <header className="border-b border-cyan-300/30 px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-200/80 neon-title">Jyogi Matsuri</p>
              <h1 className="mt-2 text-2xl font-black neon-title">MOBILE ORDER</h1>
            </div>
            <div className="rounded-2xl border border-cyan-200/40 bg-slate-900/60 px-3 py-2 glow-cyan">
              <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/70">Cart</p>
              <p className="text-xl font-black text-cyan-200">{cartCount}</p>
            </div>
          </div>
        </header>

        <section className="px-4 pt-4">
          <div className="rounded-2xl border border-fuchsia-300/30 bg-slate-900/55 p-4 shadow-[0_0_24px_rgba(255,79,207,0.22)]">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-200">Festival Night Mode</p>
            <p className="mt-2 text-sm text-cyan-100/90">暗い会場でも見やすいネオンUI。商品を選んでカートへ追加してください。</p>
          </div>
        </section>

        <section className="flex-1 overflow-y-auto px-2 py-3 animate-slide-up">
          {activeTab === "menu" ? (
            <MenuPanel cart={cart} onChangeQty={changeQty} />
          ) : (
            <CartPanel
              cart={cart}
              total={cartTotal}
              placing={placing}
              onChangeQty={changeQty}
              onPlaceOrder={handlePlaceOrder}
            />
          )}
        </section>

        <nav className="grid grid-cols-3 gap-2 border-t border-cyan-300/20 bg-slate-950/70 px-3 py-3">
          <button
            onClick={() => setActiveTab("menu")}
            className={`rounded-xl px-2 py-4 text-xs font-bold transition ${
              activeTab === "menu" ? "neon-pill bg-cyan-400/10 text-cyan-100" : "text-slate-300"
            }`}
          >
            🍜 MENU
          </button>
          <button
            onClick={() => setActiveTab("cart")}
            className={`rounded-xl px-2 py-4 text-xs font-bold transition ${
              activeTab === "cart" ? "neon-pill bg-fuchsia-400/10 text-fuchsia-100 glow-pink" : "text-slate-300"
            }`}
          >
            🛒 CART
          </button>
          <button
            onClick={() => order && setStep("waiting")}
            className={`rounded-xl px-2 py-4 text-xs font-bold transition ${
              order ? "bg-yellow-300/15 text-yellow-100 glow-yellow" : "text-slate-500"
            }`}
          >
            📦 MY ORDERS
          </button>
        </nav>
      </div>
    </main>
  );
}
