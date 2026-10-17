"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchMenuItems, fetchYakitoriFlavors, fetchYakitoriTypes, optionSnapshots, optionUnitPrice } from "@/lib/menu";
import { NewOrderItem, placeOrder } from "@/lib/orders";
import { peekNextNumber } from "@/lib/numbering";
import { createOrderId } from "@/lib/qr";
import { usePendingSync } from "@/app/components/pos/usePendingSync";
import YakitoriSetModal from "@/app/components/shared/YakitoriSetModal";
import MenuOptionsModal from "@/app/components/shared/MenuOptionsModal";
import BundleSetModal from "@/app/components/shared/BundleSetModal";
import { BundleSelection, MenuItem, MenuOption, Order, YakitoriFlavor, YakitoriSkewerSelection, YakitoriType } from "@/types";
import { supabase } from "@/lib/supabase";

type BCartItem = {
  menuItem: MenuItem;
  qty: number;
  lineId?: string;
  yakitoriSelections?: YakitoriSkewerSelection[];
  options?: MenuOption[];
  bundleSelections?: BundleSelection[];
};

export default function PosBPage() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [yakitoriFlavors, setYakitoriFlavors] = useState<YakitoriFlavor[]>([]);
  const [yakitoriTypes, setYakitoriTypes] = useState<YakitoriType[]>([]);
  const [setModalItem, setSetModalItem] = useState<MenuItem | null>(null);
  const [optionsModalItem, setOptionsModalItem] = useState<MenuItem | null>(null);
  const [bundleModalItem, setBundleModalItem] = useState<MenuItem | null>(null);
  const [pendingOptions, setPendingOptions] = useState<MenuOption[] | undefined>();
  const [cart, setCart] = useState<BCartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCheckoutConfirmation, setShowCheckoutConfirmation] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [nextNumber, setNextNumber] = useState("-");
  const { pendingCount: pendingSyncCount, lastError: pendingSyncError } = usePendingSync();

  useEffect(() => {
    let cancelled = false;
    const loadMenu = () => Promise.all([fetchMenuItems(), fetchYakitoriFlavors(), fetchYakitoriTypes()])
      .then(([items, flavors, types]) => {
        if (cancelled) return;
        setMenu(items);
        setYakitoriFlavors(flavors);
        setYakitoriTypes(types);
      })
      .catch(() => {
        if (!cancelled) setError("メニュー情報の取得に失敗しました");
      });

    void loadMenu();
    const channel = supabase
      .channel("pos-b-menu-options")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, () => void loadMenu())
      .on("postgres_changes", { event: "*", schema: "public", table: "option_groups" }, () => void loadMenu())
      .on("postgres_changes", { event: "*", schema: "public", table: "options" }, () => void loadMenu())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    setNextNumber(peekNextNumber("B"));
  }, [confirmedOrder]);

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + optionUnitPrice(item.menuItem, item.options ?? []) * item.qty, 0),
    [cart]
  );

  function addItem(menuItem: MenuItem) {
    setConfirmedOrder(null);

    if (menuItem.isSet) {
      setBundleModalItem(menuItem);
      return;
    }
    if (menuItem.optionGroups.length > 0) {
      setOptionsModalItem(menuItem);
      return;
    }
    if (menuItem.isYakitoriSet) {
      setSetModalItem(menuItem);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.menuItem.id === menuItem.id && !item.yakitoriSelections && (item.options ?? []).length === 0);
      if (existing) {
        return prev.map((item) =>
          item === existing ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { menuItem, qty: 1 }];
    });
  }

  function addOptionsToCart(menuItem: MenuItem, options: MenuOption[]) {
    setConfirmedOrder(null);
    const optionKey = options.map((option) => option.id).sort((a, b) => a - b).join(",");
    setCart((prev) => {
      const existing = prev.find((item) => item.menuItem.id === menuItem.id && !item.yakitoriSelections && item.options?.map((option) => option.id).sort((a, b) => a - b).join(",") === optionKey);
      if (existing) return prev.map((item) => item === existing ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { menuItem, qty: 1, lineId: `options-${menuItem.id}-${optionKey}`, options }];
    });
  }

  function addYakitoriSetToCart(menuItem: MenuItem, selections: YakitoriSkewerSelection[], options?: MenuOption[]) {
    setConfirmedOrder(null);
    const optionKey = (options ?? []).map((option) => option.id).sort((a, b) => a - b).join(",");
    const yakitoriKey = selections.map((selection) => `${selection.flavorId}-${selection.typeId}`).join(".");
    const lineKey = `${optionKey}|${yakitoriKey}`;
    setCart((prev) => {
      const existing = prev.find((item) => item.menuItem.id === menuItem.id && item.yakitoriSelections?.map((selection) => `${selection.flavorId}-${selection.typeId}`).join(".") === yakitoriKey && item.options?.map((option) => option.id).sort((a, b) => a - b).join(",") === optionKey);
      if (existing) return prev.map((item) => item === existing ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { menuItem, qty: 1, lineId: `yakitori-${menuItem.id}-${lineKey}`, yakitoriSelections: selections, ...(options && options.length > 0 ? { options } : {}) }];
    });
    setSetModalItem(null);
  }

  function addBundleSetToCart(menuItem: MenuItem, selections: BundleSelection[]) {
    setConfirmedOrder(null);
    const lineKey = selections.map((selection) => `${selection.slotId}-${selection.menuItem.code}-${selection.options.map((option) => option.code).sort((a, b) => a - b).join(".")}`).join(",");
    setCart((prev) => {
      const existing = prev.find((item) => item.menuItem.id === menuItem.id && item.bundleSelections?.map((selection) => `${selection.slotId}-${selection.menuItem.code}-${selection.options.map((option) => option.code).sort((a, b) => a - b).join(".")}`).join(",") === lineKey);
      if (existing) return prev.map((item) => item === existing ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { menuItem, qty: 1, lineId: `bundle-${menuItem.id}-${lineKey}`, bundleSelections: selections }];
    });
  }

  function removeYakitoriSetFromCart(lineId: string) {
    setCart((prev) => prev.filter((item) => item.lineId !== lineId));
  }

  function changeQty(menuItemId: number, delta: number) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.menuItem.id === menuItemId && !item.yakitoriSelections
            ? { ...item, qty: item.qty + delta }
            : item
        )
        .filter((item) => item.yakitoriSelections || item.qty > 0)
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
        price: optionUnitPrice(item.menuItem, item.options ?? []),
        qty: item.qty,
        yakitoriSelections: item.yakitoriSelections?.map((s) => ({
          flavorName: s.flavorName,
          typeName: s.typeName,
        })),
        optionsSnapshot: item.options && item.options.length > 0 ? optionSnapshots(item.menuItem, item.options) : undefined,
        bundleSelections: item.bundleSelections,
      }));
      const order = await placeOrder(createOrderId(), "B", items);
      setConfirmedOrder(order);
      setCart([]);
      setShowCheckoutConfirmation(false);
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
              未送信{pendingSyncCount}件・最後のエラー: {pendingSyncError ?? "送信待ち"}
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
                disabled={!item.isAvailable || item.optionGroups.some((group) => group.required && group.options.every((option) => !option.isAvailable || !option.isActive)) || (item.isSet && item.bundleSlots.some((slot) => slot.candidateItems.length === 0 || slot.candidateItems.every((candidate) => !candidate.isAvailable || !candidate.isActive || candidate.optionGroups.some((group) => group.required && group.options.every((option) => !option.isAvailable || !option.isActive)))))}
                className="rounded-xl border border-line bg-surface px-3 py-3 text-left text-sm text-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="block font-bold">
                  {item.emoji ? `${item.emoji} ` : ""}{item.name}
                  {item.isYakitoriSet && (
                    <span className="ml-1 text-xs font-bold text-brand-gold">{item.yakitoriSkewerCount}本</span>
                  )}
                    {(!item.isAvailable || item.optionGroups.some((group) => group.required && group.options.every((option) => !option.isAvailable || !option.isActive))) && <span className="ml-1 text-xs text-brand-vermilion">SOLDOUT</span>}
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
                <div key={item.lineId ?? item.menuItem.id} className="flex items-start justify-between text-sm text-ink">
                  <div>
                    <span>{item.menuItem.name}</span>
                    {item.yakitoriSelections && (
                      <span className="block text-xs text-sub">
                        {item.yakitoriSelections
                          .map((s, i) => `${i + 1}.${s.typeName}×${s.flavorName}`)
                          .join("、")}
                      </span>
                    )}
                    {item.options && item.options.length > 0 && (
                      <span className="block text-xs font-bold text-brand-indigo">
                        {item.options.map((option) => {
                          const group = item.menuItem.optionGroups.find((entry) => entry.id === option.groupId);
                          return `${group?.name ?? "選択肢"}: ${option.name}`;
                        }).join(" / ")}
                      </span>
                    )}
                    {item.bundleSelections && item.bundleSelections.length > 0 && (
                      <span className="block text-xs font-bold text-brand-indigo">
                        {item.bundleSelections.map((selection) => `${selection.slotName}: ${selection.menuItem.name}${selection.yakitoriSelections && selection.yakitoriSelections.length > 0 ? `（${selection.yakitoriSelections.map((skewer) => `${skewer.typeName}×${skewer.flavorName}`).join("、")}）` : selection.options.length > 0 ? `（${selection.options.map((option) => option.name).join("、")}）` : ""}`).join(" / ")}
                      </span>
                    )}
                  </div>
                  {item.yakitoriSelections ? (
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-right">¥{optionUnitPrice(item.menuItem, item.options ?? []).toLocaleString()}</span>
                      <button
                        onClick={() => removeYakitoriSetFromCart(item.lineId as string)}
                        className="rounded-lg border border-brand-vermilion/40 bg-brand-vermilion/10 px-2 py-1 text-xs font-bold text-brand-vermilion"
                      >
                        削除
                      </button>
                    </div>
                  ) : item.bundleSelections ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => setCart((prev) => prev.map((entry) => entry.lineId === item.lineId ? { ...entry, qty: entry.qty - 1 } : entry).filter((entry) => entry.qty > 0))} className="h-7 w-7 rounded-full border border-line text-brand-indigo">−</button>
                      <span className="w-6 text-center">{item.qty}</span>
                      <button onClick={() => setCart((prev) => prev.map((entry) => entry.lineId === item.lineId ? { ...entry, qty: entry.qty + 1 } : entry))} className="h-7 w-7 rounded-full border border-line text-brand-indigo">+</button>
                      <span className="ml-2 w-16 text-right">¥{(item.menuItem.price * item.qty).toLocaleString()}</span>
                    </div>
                  ) : (
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
                      <span className="ml-2 w-16 text-right">¥{(optionUnitPrice(item.menuItem, item.options ?? []) * item.qty).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-line bg-canvas px-3 py-6 text-center text-sm text-sub">
              メニューをタップして追加してください
            </div>
          )}

          <button
            onClick={() => setShowCheckoutConfirmation(true)}
            disabled={cart.length === 0 || isSubmitting}
            className="neon-button mt-4 w-full rounded-2xl px-4 py-4 text-base font-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "発行中..." : "内容を確認して会計"}
          </button>
        </section>
      </div>

      {showCheckoutConfirmation && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-[28px] border border-line bg-surface p-5 sm:rounded-[28px]">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-sub">最終確認</p>
            <h2 className="mt-1 text-xl font-black text-ink">注文を確定してよろしいですか？</h2>

            <div className="mt-4 space-y-3">
              {cart.map((item) => (
                <div key={item.lineId ?? item.menuItem.id} className="rounded-xl border border-line bg-canvas p-3 text-sm text-ink">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-bold">{item.menuItem.name} × {item.qty}</span>
                    <span className="font-black">¥{(optionUnitPrice(item.menuItem, item.options ?? []) * item.qty).toLocaleString()}</span>
                  </div>
                  {item.bundleSelections && item.bundleSelections.length > 0 && (
                    <p className="mt-2 text-xs font-bold text-brand-indigo">
                      {item.bundleSelections.map((selection) => `${selection.slotName}: ${selection.menuItem.name}${selection.yakitoriSelections && selection.yakitoriSelections.length > 0 ? `（${selection.yakitoriSelections.map((skewer) => `${skewer.typeName}×${skewer.flavorName}`).join("、")}）` : selection.options.length > 0 ? `（${selection.options.map((option) => option.name).join("、")}）` : ""}`).join(" / ")}
                    </p>
                  )}
                  {item.options && item.options.length > 0 && (
                    <p className="mt-2 text-xs font-bold text-brand-indigo">
                      {item.options.map((option) => option.name).join(" / ")}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-line pt-4 text-lg font-black text-ink">
              <span>合計</span>
              <span>¥{total.toLocaleString()}</span>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowCheckoutConfirmation(false)}
                className="flex-1 rounded-2xl border border-line px-4 py-3 text-sm font-bold text-sub"
              >
                戻る
              </button>
              <button
                type="button"
                onClick={() => void handleCheckout()}
                disabled={isSubmitting}
                className="neon-button flex-1 rounded-2xl px-4 py-3 text-sm font-black disabled:opacity-50"
              >
                {isSubmitting ? "発行中..." : "確定して番号発行"}
              </button>
            </div>
          </div>
        </div>
      )}

      {setModalItem && (
        <YakitoriSetModal
          menuItem={setModalItem}
          flavors={yakitoriFlavors}
          types={yakitoriTypes}
          onCancel={() => {
            setSetModalItem(null);
            setPendingOptions(undefined);
          }}
          onConfirm={(selections) => {
            addYakitoriSetToCart(setModalItem, selections, pendingOptions);
            setPendingOptions(undefined);
            setSetModalItem(null);
          }}
        />
      )}

      {optionsModalItem && (
        <MenuOptionsModal
          menuItem={optionsModalItem}
          onCancel={() => {
            setOptionsModalItem(null);
            setPendingOptions(undefined);
          }}
          onConfirm={(options) => {
            if (optionsModalItem.isYakitoriSet) {
              setPendingOptions(options);
              setOptionsModalItem(null);
              setSetModalItem(optionsModalItem);
              return;
            }
            addOptionsToCart(optionsModalItem, options);
            setOptionsModalItem(null);
          }}
        />
      )}

      {bundleModalItem && (
        <BundleSetModal
          menuItem={bundleModalItem}
          flavors={yakitoriFlavors}
          types={yakitoriTypes}
          onCancel={() => setBundleModalItem(null)}
          onConfirm={(selections) => {
            addBundleSetToCart(bundleModalItem, selections);
            setBundleModalItem(null);
          }}
        />
      )}
    </main>
  );
}
