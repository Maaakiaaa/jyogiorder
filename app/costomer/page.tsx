"use client";

import { useCallback, useEffect, useState } from "react";
import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import CartPanel from "@/app/components/costomers/CartPanel";
import CheckoutPanel from "@/app/components/costomers/CheckoutPanel";
import MenuPanel from "@/app/components/costomers/MenuPanel";
import WaitingPanel from "@/app/components/costomers/WaitingPanel";
import WelcomePanel from "@/app/components/costomers/WelcomePanel";
import { fetchMenuItems } from "@/lib/menu";
import { createOrder, getOrderCheckoutToken } from "@/lib/orders";
import { createCheckoutToken } from "@/lib/qr";
import { supabase } from "@/lib/supabase";
import { CartItem, MenuItem, Order } from "@/types";

type CustomerStep = "menu" | "checkout" | "waiting" | "welcome";
type TabType = "menu" | "cart";
type OrderInsertPayload = RealtimePostgresInsertPayload<Order & Record<string, unknown>>;

export default function CustomerPage() {
  const [step, setStep] = useState<CustomerStep>("menu");
  const [activeTab, setActiveTab] = useState<TabType>("menu");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [checkoutToken, setCheckoutToken] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [menu, setMenu] = useState<MenuItem[]>([]);

  const cartTotal = cart.reduce((sum, item) => sum + item.menuItem.price * item.qty, 0);

  const loadMenu = useCallback(async () => {
    try {
      const items = await fetchMenuItems();
      setMenu(items);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadMenu();
    const channel = supabase
      .channel("menu-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, () => loadMenu())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadMenu]);

  useEffect(() => {
    if (!checkoutToken) return;

    const channel = supabase
      .channel(`checkout-${checkoutToken}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload: OrderInsertPayload) => {
          const insertedOrder = payload.new as Order;
          if (getOrderCheckoutToken(insertedOrder.items) !== checkoutToken) return;

          setOrders((prev) => (
            prev.some((order) => order.id === insertedOrder.id) ? prev : [...prev, insertedOrder]
          ));
          setActiveOrderId(insertedOrder.id);
          setCart([]);
          setStep("waiting");
          setActiveTab("menu");
          setCheckoutToken(null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [checkoutToken]);

  function changeQty(id: number, delta: number) {
    setCart((prev) => {
      const existing = prev.find((item) => item.menuItem.id === id);
      const menuItem = menu.find((entry) => entry.id === id);
      if (!menuItem) return prev;

      if (!existing) {
        if (delta <= 0) return prev;
        return [...prev, { menuItem, qty: 1 }];
      }

      const nextQty = existing.qty + delta;
      if (nextQty <= 0) {
        return prev.filter((item) => item.menuItem.id !== id);
      }

      return prev.map((item) => (
        item.menuItem.id === id ? { ...item, qty: nextQty } : item
      ));
    });
  }

  async function handlePlaceOrder() {
    if (cart.length === 0 || placing) return;

    setPlacing(true);
    try {
      const items = cart.map((item) => ({
        name: item.menuItem.name,
        qty: item.qty,
        price: item.menuItem.price,
      }));
      const newOrder = await createOrder(items);
      setOrders((prev) => [...prev, newOrder]);
      setActiveOrderId(newOrder.id);
      setCheckoutToken(null);
      setCart([]);
      setStep("waiting");
      setActiveTab("menu");
    } catch {
      alert("注文に失敗しました。もう一度お試しください。");
    } finally {
      setPlacing(false);
    }
  }

  function handleShowQr() {
    if (cart.length === 0) return;
    setCheckoutToken(createCheckoutToken());
    setStep("checkout");
  }

  function handleDone(doneOrderId: string) {
    const remaining = orders.filter((order) => order.id !== doneOrderId);
    setOrders(remaining);

    if (remaining.length === 0) {
      setActiveOrderId(null);
      setStep("welcome");
      return;
    }

    if (activeOrderId === doneOrderId) {
      setActiveOrderId(remaining[remaining.length - 1].id);
    }
  }

  function handleReset() {
    setStep("menu");
    setActiveTab("menu");
    setOrders([]);
    setActiveOrderId(null);
    setCheckoutToken(null);
  }

  const activeOrder = activeOrderId ? orders.find((order) => order.id === activeOrderId) ?? null : null;

  if (step === "waiting" && activeOrder) {
    return (
      <WaitingPanel
        order={activeOrder}
        orders={orders}
        activeOrderId={activeOrder.id}
        onSelectOrder={setActiveOrderId}
        onDone={handleDone}
        onBackToMenu={() => setStep("menu")}
      />
    );
  }

  if (step === "checkout" && checkoutToken) {
    return (
      <CheckoutPanel
        cart={cart}
        total={cartTotal}
        checkoutToken={checkoutToken}
        onBack={() => {
          setCheckoutToken(null);
          setStep("menu");
          setActiveTab("cart");
        }}
      />
    );
  }

  if (step === "welcome") {
    return <WelcomePanel onReset={handleReset} />;
  }

  return (
    <main className="festival-bg min-h-screen px-3 py-3">
      <div className="glass-panel relative z-10 mx-auto flex min-h-[95vh] w-full max-w-md flex-col overflow-hidden rounded-[28px]">
        <header className="border-b border-cyan-300/30 px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="neon-title text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-200/80">
                TACHIBANASAI
              </p>
              <h1 className="neon-title mt-2 text-2xl font-black">MOBA JYOGI</h1>
            </div>
          </div>
        </header>

        <section className="px-4 pt-4">
          <div className="rounded-2xl border border-fuchsia-300/30 bg-slate-900/55 p-4 shadow-[0_0_24px_rgba(255,79,207,0.22)]">
            <p className="mt-2 text-sm text-cyan-100/90">商品を選んでカートへ追加してください。</p>
          </div>
        </section>

        <section className="animate-slide-up flex-1 overflow-y-auto px-2 py-3">
          {activeTab === "menu" ? (
            <MenuPanel menu={menu} cart={cart} onChangeQty={changeQty} />
          ) : (
            <CartPanel
              cart={cart}
              total={cartTotal}
              placing={placing}
              onChangeQty={changeQty}
              onPlaceOrder={handlePlaceOrder}
              onShowQr={handleShowQr}
            />
          )}
        </section>

        <nav className="grid grid-cols-3 gap-2 border-t border-cyan-300/20 bg-slate-950/70 px-3 py-4">
          <button
            onClick={() => setActiveTab("menu")}
            className={`rounded-xl px-2 py-[1.3rem] text-xs font-bold transition ${
              activeTab === "menu" ? "neon-pill bg-cyan-400/10 text-cyan-100" : "text-slate-300"
            }`}
          >
            🍜 MENU
          </button>
          <button
            onClick={() => setActiveTab("cart")}
            className={`rounded-xl px-2 py-[1.3rem] text-xs font-bold transition ${
              activeTab === "cart"
                ? "neon-pill bg-fuchsia-400/10 text-fuchsia-100 glow-pink"
                : "text-slate-300"
            }`}
          >
            🛒 CART
          </button>
          <button
            onClick={() => {
              if (orders.length === 0) return;
              if (!activeOrderId) {
                setActiveOrderId(orders[orders.length - 1].id);
              }
              setStep("waiting");
            }}
            className={`rounded-xl px-2 py-[1.3rem] text-xs font-bold transition ${
              orders.length > 0 ? "bg-yellow-300/15 text-yellow-100 glow-yellow" : "text-slate-500"
            }`}
          >
            📦 MY ORDERS {orders.length > 0 ? `(${orders.length})` : ""}
          </button>
        </nav>
      </div>
    </main>
  );
}
