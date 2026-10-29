"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { Order, MenuItem, YakitoriFlavor, YakitoriType } from "@/types";
import { fetchSalesOrders } from "@/lib/orders";
import {
  createMenuItem,
  createYakitoriFlavor,
  createYakitoriType,
  fetchAllMenuItemsForAdmin,
  fetchAllYakitoriFlavorsForAdmin,
  fetchAllYakitoriTypesForAdmin,
  fetchCategories,
  MenuCategory,
  updateMenuItem,
  updateYakitoriFlavor,
  updateYakitoriType,
  setItemAvailable,
  setYakitoriTypeAvailable,
} from "@/lib/menu";
import { supabase } from "@/lib/supabase";
import DonutChart from "@/app/components/admin/DonutChart";
import RoleGate from "@/app/components/auth/RoleGate";
import { signOutWithRole } from "@/lib/auth";

type AdminTab = "menu" | "sales" | "staff";

type ProductSales = {
  name: string;
  qty: number;
  amount: number;
};

type SkewerSales = {
  name: string;
  qty: number;
};

const ORDER_STATUS_LABELS: Record<Order["status"], string> = {
  received: "受付",
  cooking: "調理中",
  ready: "受け渡し待ち",
  handed: "受け渡し済み",
  cancelled: "キャンセル",
};

function formatOrderDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

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

function AdminContent() {
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const previousSalesOrderIdsRef = useRef<Set<string>>(new Set());
  const hasInitializedSalesRef = useRef(false);
  const authed = true;
  const [salesOrders, setSalesOrders] = useState<Order[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [yakitoriFlavors, setYakitoriFlavors] = useState<YakitoriFlavor[]>([]);
  const [yakitoriTypes, setYakitoriTypes] = useState<YakitoriType[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminTab, setAdminTab] = useState<AdminTab>("menu");
  const [editingMenuId, setEditingMenuId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [editingPrice, setEditingPrice] = useState<string>("");
  const [editingIsYakitoriSet, setEditingIsYakitoriSet] = useState(false);
  const [editingSkewerCount, setEditingSkewerCount] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState("");
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [newMenuCategoryId, setNewMenuCategoryId] = useState("");
  const [newMenuName, setNewMenuName] = useState("");
  const [newMenuPrice, setNewMenuPrice] = useState("");
  const [newMenuIsYakitoriSet, setNewMenuIsYakitoriSet] = useState(false);
  const [newMenuSkewerCount, setNewMenuSkewerCount] = useState("");
  const [isCreateMenuFormOpen, setIsCreateMenuFormOpen] = useState(false);
  const [isCreatingMenuItem, setIsCreatingMenuItem] = useState(false);
  const [newFlavorName, setNewFlavorName] = useState("");
  const [newTypeName, setNewTypeName] = useState("");
  const [staffQrUrl, setStaffQrUrl] = useState("");
  const [isOrderHistoryOpen, setIsOrderHistoryOpen] = useState(false);

  async function handleLogout() {
    await signOutWithRole();
    window.location.reload();
  }

  const load = useCallback(async () => {
    try {
      const [menuData, salesOrderData, flavorData, typeData, categoryData] = await Promise.all([
        fetchAllMenuItemsForAdmin(),
        fetchSalesOrders(),
        fetchAllYakitoriFlavorsForAdmin(),
        fetchAllYakitoriTypesForAdmin(),
        fetchCategories(),
      ]);
      setMenu(menuData);
      setCategories(categoryData);
      setSalesOrders(salesOrderData);
      setYakitoriFlavors(flavorData);
      setYakitoriTypes(typeData);
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
        if (item.parentLineId) continue;
        const current = salesMap.get(item.name) ?? { name: item.name, qty: 0, amount: 0 };
        current.qty += item.qty;
        current.amount += item.qty * item.price;
        salesMap.set(item.name, current);
      }
    }

    return Array.from(salesMap.values()).sort((a, b) => b.qty - a.qty || b.amount - a.amount || a.name.localeCompare(b.name, "ja"));
  }, [menu, salesOrders]);

  // ドリンクと焼き鳥セットは価格が種類・味に関係なく固定のため、金額ではなく本数だけを集計する。
  const { yakitoriTypeSales, yakitoriFlavorSales, totalSkewerCount } = useMemo(() => {
    const typeCounts = new Map<string, number>();
    const flavorCounts = new Map<string, number>();
    let total = 0;

    for (const order of salesOrders) {
      for (const item of order.items) {
        if (!item.yakitoriSelections) continue;
        for (const selection of item.yakitoriSelections) {
          typeCounts.set(selection.typeName, (typeCounts.get(selection.typeName) ?? 0) + item.qty);
          flavorCounts.set(selection.flavorName, (flavorCounts.get(selection.flavorName) ?? 0) + item.qty);
          total += item.qty;
        }
      }
    }

    const toSorted = (counts: Map<string, number>): SkewerSales[] =>
      Array.from(counts.entries())
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, "ja"));

    return {
      yakitoriTypeSales: toSorted(typeCounts),
      yakitoriFlavorSales: toSorted(flavorCounts),
      totalSkewerCount: total,
    };
  }, [salesOrders]);

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

  // スタッフ用ハブ(/staff)へのQR。設置時に管理者がここから他端末へ共有する。
  useEffect(() => {
    if (!authed) return;

    let cancelled = false;
    const staffUrl = `${window.location.origin}/staff`;

    QRCode.toDataURL(staffUrl, { errorCorrectionLevel: "M", margin: 1, width: 240 })
      .then((url: string) => {
        if (!cancelled) setStaffQrUrl(url);
      })
      .catch(() => {
        if (!cancelled) setStaffQrUrl("");
      });

    return () => {
      cancelled = true;
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
      .channel("admin-data")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "yakitori_types" }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authed, load]);

  async function handleMenuUpdate(menuId: number) {
    const newName = editingName.trim();
    const newPrice = parseInt(editingPrice, 10);
    if (!newName || isNaN(newPrice)) return;

    const skewerCount = parseInt(editingSkewerCount, 10);
    if (editingIsYakitoriSet && (isNaN(skewerCount) || skewerCount <= 0)) {
      alert("串の本数を正しく入力してください");
      return;
    }

    try {
      await updateMenuItem(menuId, {
        name: newName,
        price: newPrice,
        categoryId: editingCategoryId ? Number(editingCategoryId) : null,
        isYakitoriSet: editingIsYakitoriSet,
        yakitoriSkewerCount: editingIsYakitoriSet ? skewerCount : null,
      });
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
    // カテゴリ未設定だとお客さん画面で焼き鳥タブに出てしまうため、追加時は必ず選んでもらう。
    if (!newMenuCategoryId) {
      alert("カテゴリを選んでください");
      return;
    }

    const skewerCount = parseInt(newMenuSkewerCount, 10);
    if (newMenuIsYakitoriSet && (isNaN(skewerCount) || skewerCount <= 0)) {
      alert("串の本数を正しく入力してください");
      return;
    }

    setIsCreatingMenuItem(true);
    try {
      await createMenuItem({
        name,
        price,
        categoryId: Number(newMenuCategoryId),
        isYakitoriSet: newMenuIsYakitoriSet,
        yakitoriSkewerCount: newMenuIsYakitoriSet ? skewerCount : null,
      });
      setNewMenuName("");
      setNewMenuPrice("");
      setNewMenuIsYakitoriSet(false);
      setNewMenuSkewerCount("");
      setNewMenuCategoryId("");
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
    setEditingIsYakitoriSet(item.isYakitoriSet);
    setEditingSkewerCount(item.yakitoriSkewerCount?.toString() ?? "");
    setEditingCategoryId(item.categoryId === null ? "" : String(item.categoryId));
  }

  function clearMenuEditing() {
    setEditingMenuId(null);
    setEditingName("");
    setEditingPrice("");
    setEditingIsYakitoriSet(false);
    setEditingSkewerCount("");
    setEditingCategoryId("");
  }

  async function handleCreateYakitoriFlavor() {
    const name = newFlavorName.trim();
    if (!name) return;
    try {
      await createYakitoriFlavor(name);
      setNewFlavorName("");
      await load();
    } catch (error) {
      alert(`追加に失敗しました: ${getErrorMessage(error)}`);
    }
  }

  async function handleCreateYakitoriType() {
    const name = newTypeName.trim();
    if (!name) return;
    try {
      await createYakitoriType(name);
      setNewTypeName("");
      await load();
    } catch (error) {
      alert(`追加に失敗しました: ${getErrorMessage(error)}`);
    }
  }

  async function handleToggleYakitoriFlavor(id: number, currentActive: boolean) {
    try {
      await updateYakitoriFlavor(id, { isActive: !currentActive });
      await load();
    } catch (error) {
      alert(`更新に失敗しました: ${getErrorMessage(error)}`);
    }
  }

  async function handleToggleYakitoriType(id: number, currentActive: boolean) {
    try {
      await updateYakitoriType(id, { isActive: !currentActive });
      await load();
    } catch (error) {
      alert(`更新に失敗しました: ${getErrorMessage(error)}`);
    }
  }

  async function handleYakitoriTypeAvailableToggle(id: number, currentAvailable: boolean) {
    try {
      await setYakitoriTypeAvailable(id, !currentAvailable);
      await load();
    } catch (error) {
      alert(`更新に失敗しました: ${getErrorMessage(error)}`);
    }
  }

  async function handleAvailableToggle(menuId: number, currentAvailable: boolean) {
    try {
      await setItemAvailable(menuId, !currentAvailable);
      await load();
    } catch (error) {
      alert(`更新に失敗しました: ${getErrorMessage(error)}`);
    }
  }

  async function handleActiveToggle(menuId: number, currentActive: boolean) {
    try {
      await updateMenuItem(menuId, { isActive: !currentActive });
      await load();
    } catch (error) {
      alert(`更新に失敗しました: ${getErrorMessage(error)}`);
    }
  }

  return (
    <main className="min-h-screen bg-canvas px-3 py-3">
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h1 className="neon-title text-2xl text-ink">管理画面</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setAdminTab("menu")}
              className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
                adminTab === "menu"
                  ? "border-brand-indigo/40 bg-brand-indigo/10 text-brand-indigo"
                  : "border-line text-sub"
              }`}
            >
              ⚙️ 商品管理
            </button>
            <button
              onClick={() => setAdminTab("sales")}
              className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
                adminTab === "sales"
                  ? "border-brand-gold/40 bg-brand-gold/10 text-brand-gold"
                  : "border-line text-sub"
              }`}
            >
              📈 販売実績
            </button>
            <button
              onClick={() => setAdminTab("staff")}
              className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
                adminTab === "staff"
                  ? "border-brand-indigo/40 bg-brand-indigo/10 text-brand-indigo"
                  : "border-line text-sub"
              }`}
            >
              👥 スタッフ
            </button>
            <button onClick={handleLogout} className="rounded-xl border border-line px-3 py-2 text-sm font-bold text-brand-vermilion">
              ログアウト
            </button>
          </div>
        </div>

        {loading && <div className="py-16 text-center text-sub">読み込み中...</div>}

        {/* 販売実績タブ */}
        {adminTab === "sales" && (
          <div className="space-y-3">
            <section className="rounded-2xl border border-line bg-canvas p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-base font-black text-ink">販売実績</p>
                <p className="text-xs font-bold text-brand-indigo">
                  {totalSoldCount}個 / ¥{totalSalesAmount.toLocaleString()}
                </p>
              </div>
              <p className="mb-3 text-xs text-sub">
                売上額は各注文が成立した時点の単価で集計しています。現在の商品価格を後から変更しても、過去の売上額は変わりません。
              </p>

              <div className="space-y-2">
                {productSales.length > 0 ? (
                  productSales.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2"
                    >
                      <p className="text-sm font-bold text-ink">{item.name}</p>
                      <div className="text-right">
                        <p className="text-sm font-black text-brand-indigo">{item.qty}個</p>
                        <p className="text-xs text-sub">¥{item.amount.toLocaleString()}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-line bg-surface px-3 py-4 text-center text-sm text-sub">
                    まだ販売実績はありません
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-canvas p-4">
              <button
                type="button"
                onClick={() => setIsOrderHistoryOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-3 text-left"
                aria-expanded={isOrderHistoryOpen}
              >
                <span className="text-base font-black text-ink">注文履歴</span>
                <span className="flex items-center gap-2 text-xs text-sub">
                  {salesOrders.length}件
                  <span className="text-base text-brand-indigo">{isOrderHistoryOpen ? "▲" : "▼"}</span>
                </span>
              </button>

              {isOrderHistoryOpen && salesOrders.length > 0 ? (
                <div className="space-y-3">
                  {salesOrders.map((order) => {
                    const orderItems = order.items.filter((item) => !item.parentLineId);
                    return (
                      <article key={order.id} className="rounded-xl border border-line bg-surface p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-black text-ink">注文 {order.number}</p>
                            <p className="mt-1 text-xs text-sub">
                              {formatOrderDate(order.created_at)} ・ {ORDER_STATUS_LABELS[order.status]}
                            </p>
                          </div>
                          <p className="text-lg font-black text-brand-indigo">¥{order.total.toLocaleString()}</p>
                        </div>

                        <div className="mt-3 space-y-2 border-t border-line pt-3">
                          {orderItems.map((item) => {
                            const childItems = order.items.filter((child) => child.parentLineId === item.lineId);
                            return (
                              <div key={item.lineId ?? `${order.id}-${item.name}`} className="flex items-start justify-between gap-3 text-sm">
                                <div className="min-w-0">
                                  <p className="font-bold text-ink">{item.name} × {item.qty}</p>
                                  {item.optionsSnapshot && item.optionsSnapshot.length > 0 && (
                                    <p className="mt-1 text-xs text-sub">
                                      {item.optionsSnapshot.map((option) => `${option.groupName}: ${option.name}`).join(" / ")}
                                    </p>
                                  )}
                                  {item.yakitoriSelections && item.yakitoriSelections.length > 0 && (
                                    <p className="mt-1 text-xs text-sub">
                                      {item.yakitoriSelections.map((skewer, index) => `${index + 1}.${skewer.typeName}×${skewer.flavorName}`).join("、")}
                                    </p>
                                  )}
                                  {childItems.length > 0 && (
                                    <div className="mt-1 border-l-2 border-line pl-2 text-xs text-sub">
                                      {childItems.map((child) => (
                                        <p key={child.lineId ?? `${order.id}-${child.name}`}>{child.name} × {child.qty}</p>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <p className="shrink-0 font-bold text-ink">
                                  ¥{(item.price * item.qty).toLocaleString()}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : isOrderHistoryOpen ? (
                <div className="rounded-xl border border-line bg-surface px-3 py-4 text-center text-sm text-sub">
                  まだ注文履歴はありません
                </div>
              ) : null}
            </section>

            {totalSkewerCount > 0 && (
              <section className="rounded-2xl border border-line bg-canvas p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-base font-black text-ink">ドリンクと焼き鳥セットの内訳</p>
                  <p className="text-xs font-bold text-brand-gold">串 {totalSkewerCount}本</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-line bg-surface p-3">
                    <p className="text-sm font-bold text-ink">種類別</p>
                    <div className="mt-3">
                      <DonutChart data={yakitoriTypeSales.map((s) => ({ name: s.name, value: s.qty }))} />
                    </div>
                  </div>

                  <div className="rounded-xl border border-line bg-surface p-3">
                    <p className="text-sm font-bold text-ink">味別</p>
                    <div className="mt-3">
                      <DonutChart data={yakitoriFlavorSales.map((s) => ({ name: s.name, value: s.qty }))} />
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {/* スタッフタブ */}
        {adminTab === "staff" && (
          <div className="space-y-3">
            <section className="rounded-2xl border border-line bg-canvas p-4 text-center">
              <p className="text-base font-black text-ink">スタッフ用リンク(/staff)</p>
              <p className="mt-1 text-xs text-sub">
                各端末でこのQRを読み取ると、POS・調理ディスプレイ・呼び出しボードなどへのリンク一覧が開きます。
                設置時に1回スキャンしてホーム画面に追加/ブックマークしておいてもらってください。
              </p>

              {staffQrUrl ? (
                <Image
                  src={staffQrUrl}
                  alt="スタッフ用リンクQRコード"
                  width={240}
                  height={240}
                  unoptimized
                  className="mx-auto mt-4 rounded-lg bg-white p-3"
                />
              ) : (
                <div className="mx-auto mt-4 flex h-60 w-60 items-center justify-center rounded-lg bg-surface text-sm text-sub">
                  QRコードを生成中...
                </div>
              )}

              <Link
                href="/staff"
                className="mt-4 inline-block rounded-xl border border-brand-indigo/40 bg-brand-indigo/10 px-4 py-2 text-sm font-bold text-brand-indigo"
              >
                この端末でスタッフ画面を開く →
              </Link>
            </section>
          </div>
        )}

        {/* 商品管理タブ */}
        {adminTab === "menu" && (
          <div className="space-y-3">
            <section className="rounded-2xl border border-line bg-canvas p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-base font-black text-ink">新しい商品を追加</p>
                <button
                  onClick={() => setIsCreateMenuFormOpen((prev) => !prev)}
                  className="rounded-lg border border-brand-indigo/40 bg-brand-indigo/10 px-4 py-2 text-sm font-bold text-brand-indigo"
                >
                  {isCreateMenuFormOpen ? "閉じる" : "商品を追加する"}
                </button>
              </div>

              {isCreateMenuFormOpen && (
                <div className="mt-3 space-y-2">
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_110px_140px_auto_auto]">
                    <input
                      type="text"
                      value={newMenuName}
                      onChange={(e) => setNewMenuName(e.target.value)}
                      placeholder="商品名"
                      className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none"
                      autoFocus
                    />
                    <input
                      type="number"
                      value={newMenuPrice}
                      onChange={(e) => setNewMenuPrice(e.target.value)}
                      placeholder="価格"
                      className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none"
                    />
                    <select
                      value={newMenuCategoryId}
                      onChange={(e) => setNewMenuCategoryId(e.target.value)}
                      className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none"
                    >
                      <option value="">カテゴリを選択</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleCreateMenuItem}
                      disabled={isCreatingMenuItem}
                      className="rounded-lg border border-brand-indigo/40 bg-brand-indigo/10 px-4 py-2 text-sm font-bold text-brand-indigo disabled:opacity-50"
                    >
                      {isCreatingMenuItem ? "追加中..." : "追加"}
                    </button>
                    <button
                      onClick={() => {
                        setIsCreateMenuFormOpen(false);
                        setNewMenuName("");
                        setNewMenuPrice("");
                        setNewMenuIsYakitoriSet(false);
                        setNewMenuSkewerCount("");
                        setNewMenuCategoryId("");
                      }}
                      className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-sub"
                    >
                      キャンセル
                    </button>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-sub">
                    <input
                      type="checkbox"
                      checked={newMenuIsYakitoriSet}
                      onChange={(e) => setNewMenuIsYakitoriSet(e.target.checked)}
                    />
                    ドリンクと焼き鳥セット（串ごとに味・種類を選べる）
                  </label>

                  {newMenuIsYakitoriSet && (
                    <input
                      type="number"
                      value={newMenuSkewerCount}
                      onChange={(e) => setNewMenuSkewerCount(e.target.value)}
                      placeholder="本数(例: 3)"
                      className="w-32 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none"
                    />
                  )}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-line bg-canvas p-4">
              <p className="text-base font-black text-ink">焼き鳥の味・種類</p>
              <p className="mt-1 text-xs text-sub">
                串の味(たれ/塩など)と種類(もも/ねぎま/かわなど)を管理します。                無効化すると選択肢から外れます。販売中/SOLDOUTは当日の在庫切替です。
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-bold text-ink">味</p>
                  <div className="mt-2 space-y-2">
                    {yakitoriFlavors.map((flavor) => (
                      <div
                        key={flavor.id}
                        className="flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-2"
                      >
                        <span className={`text-sm ${flavor.isActive ? "text-ink" : "text-sub line-through"}`}>
                          {flavor.name}
                        </span>
                        <button
                          onClick={() => handleToggleYakitoriFlavor(flavor.id, flavor.isActive)}
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${
                            flavor.isActive
                              ? "border-emerald-400/60 bg-emerald-50 text-emerald-700"
                              : "border-line text-sub"
                          }`}
                        >
                          {flavor.isActive ? "有効" : "無効"}
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={newFlavorName}
                      onChange={(e) => setNewFlavorName(e.target.value)}
                      placeholder="味を追加(例: 味噌)"
                      className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none"
                    />
                    <button
                      onClick={handleCreateYakitoriFlavor}
                      className="rounded-lg border border-brand-indigo/40 bg-brand-indigo/10 px-3 py-2 text-sm font-bold text-brand-indigo"
                    >
                      追加
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-bold text-ink">種類</p>
                  <div className="mt-2 space-y-2">
                    {yakitoriTypes.map((type) => (
                      <div
                        key={type.id}
                        className="flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-2"
                      >
                        <span className={`text-sm ${type.isActive ? "text-ink" : "text-sub line-through"}`}>
                          {type.name}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleYakitoriTypeAvailableToggle(type.id, type.isAvailable)}
                            disabled={!type.isActive}
                            className={`rounded-full border px-3 py-1 text-xs font-bold disabled:opacity-40 ${
                              type.isAvailable
                                ? "border-emerald-400/60 bg-emerald-50 text-emerald-700"
                                : "border-brand-vermilion/50 bg-brand-vermilion/10 text-brand-vermilion"
                            }`}
                          >
                            {type.isAvailable ? "販売中" : "SOLDOUT"}
                          </button>
                          <button
                            onClick={() => handleToggleYakitoriType(type.id, type.isActive)}
                            className={`rounded-full border px-3 py-1 text-xs font-bold ${
                              type.isActive
                                ? "border-line text-sub"
                                : "border-line text-sub"
                            }`}
                          >
                            {type.isActive ? "有効" : "無効"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={newTypeName}
                      onChange={(e) => setNewTypeName(e.target.value)}
                      placeholder="種類を追加(例: 手羽)"
                      className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none"
                    />
                    <button
                      onClick={handleCreateYakitoriType}
                      className="rounded-lg border border-brand-indigo/40 bg-brand-indigo/10 px-3 py-2 text-sm font-bold text-brand-indigo"
                    >
                      追加
                    </button>
                  </div>
                </div>
              </div>
            </section>
            {menu.map((item) => (
              <article key={item.id} className={`rounded-2xl border p-4 transition ${
                !item.isActive
                  ? "border-line bg-canvas opacity-60"
                  : !item.isAvailable
                    ? "border-brand-vermilion/30 bg-brand-vermilion/5"
                    : "border-line bg-surface"
              }`}>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    {editingMenuId === item.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="rounded-lg border border-line bg-canvas px-3 py-1.5 text-sm font-bold text-ink outline-none"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <p className="text-base font-black text-ink">
                        {item.emoji ? `${item.emoji} ` : ""}{item.name}
                        {item.isYakitoriSet && (
                          <span className="ml-2 text-xs font-bold text-brand-gold">
                            セット({item.yakitoriSkewerCount}本)
                          </span>
                        )}
                        {!item.isActive && <span className="ml-2 text-xs font-bold text-sub">非表示</span>}
                      </p>
                    )}
                    {editingMenuId !== item.id && (
                      <p className={`mt-1 text-xs font-bold ${item.categoryName ? "text-sub" : "text-brand-vermilion"}`}>
                        {item.categoryName ? `カテゴリ: ${item.categoryName}` : "カテゴリ未設定（焼き鳥タブに表示されます）"}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAvailableToggle(item.id, item.isAvailable)}
                      disabled={!item.isActive}
                      className={`rounded-full border px-4 py-2 text-xs font-bold transition disabled:opacity-40 ${
                        item.isAvailable
                          ? "border-emerald-400/60 bg-emerald-50 text-emerald-700"
                          : "border-brand-vermilion/50 bg-brand-vermilion/10 text-brand-vermilion"
                      }`}
                    >
                      {item.isAvailable ? "販売中" : "SOLDOUT"}
                    </button>
                    <button
                      onClick={() => handleActiveToggle(item.id, item.isActive)}
                      className="rounded-full border border-line bg-canvas px-4 py-2 text-xs font-bold text-sub"
                    >
                      {item.isActive ? "削除" : "復元"}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-sub">価格:</span>
                  {editingMenuId === item.id ? (
                    <div className="flex flex-1 flex-wrap items-center gap-2">
                      <input
                        type="number"
                        value={editingPrice}
                        onChange={(e) => setEditingPrice(e.target.value)}
                        className="w-20 rounded-lg border border-line bg-canvas px-2 py-1 text-sm text-ink outline-none"
                      />

                      <select
                        value={editingCategoryId}
                        onChange={(e) => setEditingCategoryId(e.target.value)}
                        className="rounded-lg border border-line bg-canvas px-2 py-1 text-sm text-ink outline-none"
                      >
                        <option value="">カテゴリ未設定</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>{category.name}</option>
                        ))}
                      </select>

                      <label className="flex items-center gap-1 text-xs text-sub">
                        <input
                          type="checkbox"
                          checked={editingIsYakitoriSet}
                          onChange={(e) => setEditingIsYakitoriSet(e.target.checked)}
                        />
                        セット
                      </label>
                      {editingIsYakitoriSet && (
                        <input
                          type="number"
                          value={editingSkewerCount}
                          onChange={(e) => setEditingSkewerCount(e.target.value)}
                          placeholder="本数"
                          className="w-20 rounded-lg border border-line bg-canvas px-2 py-1 text-sm text-ink outline-none"
                        />
                      )}

                      <button
                        onClick={() => handleMenuUpdate(item.id)}
                        className="rounded-lg border border-emerald-400/60 bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700"
                      >
                        保存
                      </button>
                      <button
                        onClick={clearMenuEditing}
                        className="rounded-lg border border-line px-3 py-1 text-sm font-bold text-sub"
                      >
                        キャンセル
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-brand-indigo">¥{item.price}</span>
                      <button
                        onClick={() => startMenuEditing(item)}
                        className="rounded-lg border border-brand-indigo/40 bg-brand-indigo/10 px-3 py-1 text-sm font-bold text-brand-indigo"
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

export default function AdminPage() {
  return <RoleGate roles={["admin"]}><AdminContent /></RoleGate>;
}
