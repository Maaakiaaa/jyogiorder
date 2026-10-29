"use client";

import { useEffect, useRef, useState } from "react";
import CartPanel from "@/app/components/customer/CartPanel";
import CheckoutPanel from "@/app/components/customer/CheckoutPanel";
import MenuPanel from "@/app/components/customer/MenuPanel";
import WaitingPanel from "@/app/components/customer/WaitingPanel";
import WelcomePanel from "@/app/components/customer/WelcomePanel";
import { fetchMenuItems, fetchYakitoriFlavors, fetchYakitoriTypes, isLineSoldOut, loadMenuCache, saveMenuCache } from "@/lib/menu";
import { fetchOrder } from "@/lib/orders";
import { createOrderId } from "@/lib/qr";
import { supabase } from "@/lib/supabase";
import { loadCustomerSession, saveCustomerSession } from "@/lib/customerSession";
import { BundleSelection, CartItem, MenuItem, MenuOption, Order, YakitoriFlavor, YakitoriSkewerSelection, YakitoriType } from "@/types";

type CustomerStep = "menu" | "checkout" | "waiting" | "welcome";
type TabType = "menu" | "cart";

const WAITING_TIMEOUT_MS = 10000;
const MENU_RETRY_MS = 15000;

// live: 最新を取得済み / stale: 取得に失敗し前回のキャッシュを表示中 / error: 表示できるメニューがない
type MenuStatus = "loading" | "live" | "stale" | "error";

export default function Home() {
  const [step, setStep] = useState<CustomerStep>("menu");
  const [activeTab, setActiveTab] = useState<TabType>("menu");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [waitingTimedOut, setWaitingTimedOut] = useState(false);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [yakitoriFlavors, setYakitoriFlavors] = useState<YakitoriFlavor[]>([]);
  const [yakitoriTypes, setYakitoriTypes] = useState<YakitoriType[]>([]);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [menuStatus, setMenuStatus] = useState<MenuStatus>("loading");
  const reloadMenuRef = useRef<(() => void) | null>(null);

  const cartTotal = cart.reduce((sum, item) => (
    sum + (item.menuItem.price + (item.options ?? []).reduce((optionSum, option) => optionSum + option.priceDelta, 0)) * item.qty
  ), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  // カートの品目は追加時点の情報なので、最新のメニューで売り切れになっていないか毎回確認する。
  // メニュー取得に失敗して空のときは判定できないため、全部を売り切れ扱いにはしない。
  function isCartItemSoldOut(item: CartItem): boolean {
    if (menu.length === 0) return false;
    return isLineSoldOut(menu, yakitoriTypes, {
      menuItemId: item.menuItem.id,
      optionIds: (item.options ?? []).map((option) => option.id),
      yakitoriTypeIds: item.yakitoriSelections?.map((selection) => selection.typeId),
      bundleSelections: item.bundleSelections?.map((selection) => ({
        slotId: selection.slotId,
        menuItemId: selection.menuItem.id,
        optionIds: selection.options.map((option) => option.id),
        yakitoriTypeIds: selection.yakitoriSelections?.map((skewer) => skewer.typeId),
      })),
    });
  }
  const hasSoldOutInCart = cart.some(isCartItemSoldOut);

  // リロード対策: 支払い確定済み(まだ受け渡し済みでない)の注文IDだけをlocalStorageに
  // 退避しておき、再訪時にDBの最新状態で復元する。カート・QR提示中の状態はここでは
  // 復元しない(何も確定していないため、最初からやり直しても実害がない)。
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const session = loadCustomerSession();
      if (session.orderIds.length === 0) {
        setSessionRestored(true);
        return;
      }

      const fetched = await Promise.all(session.orderIds.map((id) => fetchOrder(id)));
      if (cancelled) return;

      const restoredOrders = fetched.filter(
        (order): order is Order => order !== null && order.status !== "handed"
      );

      if (restoredOrders.length > 0) {
        setOrders(restoredOrders);
        const activeId = restoredOrders.some((o) => o.id === session.activeOrderId)
          ? session.activeOrderId
          : restoredOrders[restoredOrders.length - 1].id;
        setActiveOrderId(activeId);
        setStep("waiting");
      }

      setSessionRestored(true);
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionRestored) return;
    saveCustomerSession(orders.map((order) => order.id), activeOrderId);
  }, [sessionRestored, orders, activeOrderId]);

  // メニューは原則2(重いものはオフライン)に従い端末にキャッシュする。開いた瞬間はキャッシュを出し、
  // 最新が取れたら差し替える。取れない間は「前回のメニュー」である旨を表示し、定期的に取り直す。
  useEffect(() => {
    let cancelled = false;
    let hasMenu = false;
    let isLive = false;

    async function loadMenu() {
      const cached = hasMenu ? null : loadMenuCache();
      if (cached && !cancelled) {
        setMenu(cached.items);
        setYakitoriFlavors(cached.flavors);
        setYakitoriTypes(cached.types);
        hasMenu = true;
      }

      try {
        const [items, flavors, types] = await Promise.all([
          fetchMenuItems(),
          fetchYakitoriFlavors(),
          fetchYakitoriTypes(),
        ]);
        if (cancelled) return;
        setMenu(items);
        setYakitoriFlavors(flavors);
        setYakitoriTypes(types);
        hasMenu = true;
        isLive = true;
        setMenuStatus("live");
        saveMenuCache({ items, flavors, types, savedAt: new Date().toISOString() });
      } catch (error) {
        console.error("メニューの取得に失敗しました", error);
        if (cancelled) return;
        isLive = false;
        setMenuStatus(hasMenu ? "stale" : "error");
      }
    }

    reloadMenuRef.current = () => void loadMenu();
    const handleOnline = () => void loadMenu();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void loadMenu();
    };
    const retry = setInterval(() => {
      if (!isLive) void loadMenu();
    }, MENU_RETRY_MS);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    void loadMenu();
    const channel = supabase
      .channel("menu-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, () => void loadMenu())
      .on("postgres_changes", { event: "*", schema: "public", table: "option_groups" }, () => void loadMenu())
      .on("postgres_changes", { event: "*", schema: "public", table: "options" }, () => void loadMenu())
      .on("postgres_changes", { event: "*", schema: "public", table: "yakitori_flavors" }, () => void loadMenu())
      .on("postgres_changes", { event: "*", schema: "public", table: "yakitori_types" }, () => void loadMenu())
      .subscribe();

    return () => {
      cancelled = true;
      reloadMenuRef.current = null;
      clearInterval(retry);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, []);

  // QR提示中: レジ端末がこのQRを読んで支払いを確定させると orders 行が生まれる。
  // 挿入イベントの捕捉を主経路にしつつ、電波が細って通知を取りこぼした場合に備えて
  // 定期的に直接取得もする(保険としての再取得)。
  useEffect(() => {
    if (!pendingOrderId) return;

    const orderId = pendingOrderId;
    let cancelled = false;
    let fetching = false;
    const timeout = setTimeout(() => setWaitingTimedOut(true), WAITING_TIMEOUT_MS);

    const handleConfirmed = (order: Order) => {
      setOrders((prev) => (prev.some((o) => o.id === order.id) ? prev : [...prev, order]));
      setActiveOrderId(order.id);
      setPendingOrderId(null);
      setWaitingTimedOut(false);
      setCart([]);
      setStep("waiting");
      setActiveTab("menu");
    };

    async function fetchPendingOrder() {
      if (cancelled || fetching) return;
      fetching = true;
      try {
        const order = await fetchOrder(orderId);
        if (order && !cancelled) handleConfirmed(order);
      } finally {
        fetching = false;
      }
    }

    const channel = supabase
      .channel(`checkout-${orderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        async () => {
          await fetchPendingOrder();
        }
      )
      .subscribe();

    const poll = setInterval(() => void fetchPendingOrder(), 3000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void fetchPendingOrder();
    };
    const handleOnline = () => void fetchPendingOrder();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    void fetchPendingOrder();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      clearInterval(poll);
      clearTimeout(timeout);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
    };
  }, [pendingOrderId]);

  function getLineKey(options?: MenuOption[], yakitoriSelections?: YakitoriSkewerSelection[]) {
    const optionKey = (options ?? []).map((option) => option.id).sort((a, b) => a - b).join(",");
    const yakitoriKey = (yakitoriSelections ?? []).map((selection) => `${selection.flavorId}-${selection.typeId}`).join(".");
    return `${optionKey}|${yakitoriKey}`;
  }

  function addItemToCart(menuItem: MenuItem, options?: MenuOption[]) {
    setCart((prev) => {
      const lineKey = getLineKey(options);
      const existing = prev.find((item) => item.menuItem.id === menuItem.id && getLineKey(item.options) === lineKey && !item.yakitoriSelections);
      if (existing) {
        return prev.map((item) => item === existing ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, {
        menuItem,
        qty: 1,
        ...(options && options.length > 0 ? { options } : {}),
        ...(options && options.length > 0 ? { lineId: `options-${menuItem.id}-${lineKey}` } : {}),
      }];
    });
  }

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

  function changeLineQty(lineId: string, delta: number) {
    setCart((prev) => prev
      .map((item) => item.lineId === lineId ? { ...item, qty: item.qty + delta } : item)
      .filter((item) => item.qty > 0));
  }

  function addYakitoriSetToCart(menuItem: MenuItem, selections: YakitoriSkewerSelection[], options?: MenuOption[]) {
    const lineKey = getLineKey(options, selections);
    setCart((prev) => {
      const existing = prev.find((item) => item.menuItem.id === menuItem.id && getLineKey(item.options, item.yakitoriSelections) === lineKey);
      if (existing) return prev.map((item) => item === existing ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { menuItem, qty: 1, lineId: `yakitori-${menuItem.id}-${lineKey}`, yakitoriSelections: selections, ...(options && options.length > 0 ? { options } : {}) }];
    });
  }

  function addBundleSetToCart(menuItem: MenuItem, selections: BundleSelection[]) {
    const lineKey = selections
      .map((selection) => `${selection.slotId}-${selection.menuItem.code}-${selection.options.map((option) => option.code).sort((a, b) => a - b).join(".")}`)
      .join(",");
    setCart((prev) => {
      const existing = prev.find((item) => item.menuItem.id === menuItem.id && item.bundleSelections?.map((selection) => `${selection.slotId}-${selection.menuItem.code}-${selection.options.map((option) => option.code).sort((a, b) => a - b).join(".")}`).join(",") === lineKey);
      if (existing) return prev.map((item) => item === existing ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { menuItem, qty: 1, lineId: `bundle-${menuItem.id}-${lineKey}`, bundleSelections: selections }];
    });
  }

  function removeYakitoriSetFromCart(lineId: string) {
    setCart((prev) => prev.filter((item) => item.lineId !== lineId));
  }

  function removeLineFromCart(target: CartItem) {
    setCart((prev) => prev.filter((item) => item !== target));
  }

  function handleShowQr() {
    if (cart.length === 0 || hasSoldOutInCart) return;
    setPendingOrderId(createOrderId());
    setWaitingTimedOut(false);
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
    setPendingOrderId(null);
  }

  const activeOrder = activeOrderId ? orders.find((order) => order.id === activeOrderId) ?? null : null;

  if (step === "waiting" && activeOrder) {
    return (
      <WaitingPanel
        key={activeOrder.id}
        order={activeOrder}
        orders={orders}
        activeOrderId={activeOrder.id}
        onSelectOrder={setActiveOrderId}
        onDone={handleDone}
        onBackToMenu={() => setStep("menu")}
      />
    );
  }

  if (step === "checkout" && pendingOrderId) {
    return (
      <CheckoutPanel
        cart={cart}
        total={cartTotal}
        orderId={pendingOrderId}
        timedOut={waitingTimedOut}
        onBack={() => {
          setPendingOrderId(null);
          setWaitingTimedOut(false);
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
        <header className="border-b-2 border-brand-gold bg-gradient-to-r from-brand-indigo-dark to-brand-indigo px-4 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-brand-gold/90">
                TACHIBANASAI
              </p>
              <h1 className="neon-title mt-2 text-2xl text-white">MOBA JYOGI</h1>
            </div>
          </div>
        </header>

        <section className="px-4 pt-4">
          {menuStatus === "error" ? (
            <div className="rounded-2xl border border-brand-vermilion/40 bg-brand-vermilion/10 p-4">
              <p className="text-sm font-bold text-brand-vermilion">メニューを読み込めませんでした。</p>
              <p className="mt-1 text-xs text-sub">通信が不安定なようです。自動で再試行しています。レジでの直接注文もできます。</p>
              <button
                onClick={() => reloadMenuRef.current?.()}
                className="mt-3 rounded-full border border-brand-vermilion/40 bg-surface px-4 py-2 text-xs font-bold text-brand-vermilion"
              >
                もう一度読み込む
              </button>
            </div>
          ) : menuStatus === "stale" ? (
            <div className="rounded-2xl border border-brand-gold/40 bg-brand-gold/10 p-4">
              <p className="text-sm font-bold text-brand-gold">通信が不安定なため、前回読み込んだメニューを表示しています。</p>
              <p className="mt-1 text-xs text-sub">売り切れが反映されていない場合があります。最終的にはレジで確認します。</p>
            </div>
          ) : menuStatus === "loading" && menu.length === 0 ? (
            <div className="rounded-2xl border border-line bg-canvas p-4">
              <p className="text-sm text-sub">メニューを読み込み中…</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-line bg-canvas p-4">
              <p className="text-sm text-sub">商品を選んでカートへ追加してください。</p>
            </div>
          )}
        </section>

        <section className="animate-slide-up flex-1 overflow-y-auto px-2 py-3">
          {activeTab === "menu" ? (
            <MenuPanel
              menu={menu}
              cart={cart}
              yakitoriFlavors={yakitoriFlavors}
              yakitoriTypes={yakitoriTypes}
              onChangeQty={changeQty}
              onAddItem={addItemToCart}
              onAddYakitoriSet={addYakitoriSetToCart}
              onAddBundleSet={addBundleSetToCart}
            />
          ) : (
            <CartPanel
              cart={cart}
              total={cartTotal}
              onChangeQty={changeQty}
              onChangeLineQty={changeLineQty}
              onRemoveYakitoriSet={removeYakitoriSetFromCart}
              onRemoveLine={removeLineFromCart}
              isSoldOut={isCartItemSoldOut}
              onShowQr={handleShowQr}
            />
          )}
        </section>

        {activeTab === "menu" && cartCount > 0 && (
          <div className="border-t border-line bg-surface px-4 pt-3">
            <button
              onClick={() => setActiveTab("cart")}
              className="neon-button flex h-14 w-full items-center justify-between rounded-full px-5 text-sm font-black transition-all"
            >
              <span>🛒 {cartCount}点　¥{cartTotal.toLocaleString()}</span>
              <span>{hasSoldOutInCart ? "⚠ 売り切れあり →" : "注文を確認する →"}</span>
            </button>
          </div>
        )}

        <nav className="grid grid-cols-3 gap-2 border-t border-line bg-surface px-3 py-4">
          <button
            onClick={() => setActiveTab("menu")}
            className={`rounded-xl px-2 py-[1.3rem] text-xs font-bold transition ${
              activeTab === "menu" ? "neon-pill bg-brand-indigo/10 text-brand-indigo" : "text-sub"
            }`}
          >
            🍜 MENU
          </button>
          <button
            onClick={() => setActiveTab("cart")}
            className={`rounded-xl px-2 py-[1.3rem] text-xs font-bold transition ${
              activeTab === "cart" ? "neon-pill bg-brand-gold/10 text-brand-gold" : "text-sub"
            }`}
          >
            🛒 注文確認
          </button>
          <button
            onClick={() => {
              if (orders.length === 0) return;
              if (!activeOrderId) {
                setActiveOrderId(orders[orders.length - 1].id);
              }
              setStep("waiting");
            }}
            disabled={orders.length === 0}
            className={`rounded-xl px-2 py-[1.3rem] text-xs font-bold transition ${
              orders.length > 0 ? "bg-brand-indigo/10 text-brand-indigo" : "text-sub"
            }`}
          >
            📦 自分の注文 {orders.length > 0 ? `(${orders.length})` : ""}
            {orders.length === 0 && (
              <span className="mt-1 block text-[10px] font-normal">会計後に表示されます</span>
            )}
          </button>
        </nav>
      </div>
    </main>
  );
}
