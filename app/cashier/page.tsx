"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { fetchMenuItems } from "@/lib/menu";
import { createOrder } from "@/lib/orders";
import { parseQrPayload } from "@/lib/qr";
import { MenuItem, Order, OrderItem, QrOrderPayload } from "@/types";

type ScannedLineItem = {
  menuId: number;
  name: string;
  price: number;
  qty: number;
};

export default function CashierPage() {
  const scanInputRef = useRef<HTMLInputElement | null>(null);

  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [scanError, setScanError] = useState("");
  const [rawQrText, setRawQrText] = useState("");
  const [qrPayload, setQrPayload] = useState<QrOrderPayload | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  useEffect(() => {
    fetchMenuItems()
      .then((items) => setMenu(items))
      .catch(() => {
        setScanError("メニュー情報の取得に失敗しました");
      });
  }, []);

  useEffect(() => {
    scanInputRef.current?.focus();
  }, []);

  const scannedItems = useMemo<ScannedLineItem[]>(() => {
    if (!qrPayload) return [];

    const merged = new Map<number, ScannedLineItem>();

    for (const item of qrPayload.items) {
      const menuItem = menu.find((menuEntry) => menuEntry.id === item.menuId);
      if (!menuItem) continue;

      const current = merged.get(item.menuId) ?? {
        menuId: item.menuId,
        name: menuItem.name,
        price: menuItem.price,
        qty: 0,
      };

      current.qty += item.qty;
      merged.set(item.menuId, current);
    }

    return Array.from(merged.values());
  }, [menu, qrPayload]);

  const total = useMemo(
    () => scannedItems.reduce((sum, item) => sum + item.price * item.qty, 0),
    [scannedItems]
  );

  const hasMissingItems = qrPayload ? scannedItems.length !== qrPayload.items.length : false;

  function handleScanResult(rawValue: string) {
    const payload = parseQrPayload(rawValue);
    setQrPayload(payload);
    setRawQrText(rawValue.trim().toUpperCase());
    setScanError("");
    setCreatedOrder(null);
  }

  function handleImport(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    try {
      handleScanResult(rawQrText);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "QRコードの解析に失敗しました");
    }
  }

  async function handleCreateOrder() {
    if (scannedItems.length === 0 || isSubmittingOrder || hasMissingItems) return;

    setIsSubmittingOrder(true);
    try {
      const items: OrderItem[] = scannedItems.map((item) => ({
        name: item.name,
        qty: item.qty,
        price: item.price,
      }));
      const order = await createOrder(items, qrPayload?.checkoutToken);
      setCreatedOrder(order);
      setQrPayload(null);
      setRawQrText("");
      setScanError("");
      scanInputRef.current?.focus();
    } catch {
      setScanError("注文登録に失敗しました");
    } finally {
      setIsSubmittingOrder(false);
    }
  }

  function resetScan() {
    setQrPayload(null);
    setRawQrText("");
    setCreatedOrder(null);
    setScanError("");
    scanInputRef.current?.focus();
  }

  return (
    <main className="festival-bg min-h-screen px-3 py-3">
      <div className="glass-panel relative z-10 mx-auto flex min-h-[95vh] w-full max-w-md flex-col rounded-[28px] p-4">
        <header className="border-b border-cyan-300/20 pb-4">
          <p className="neon-title text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-200/80">
            Cashier
          </p>
          <h1 className="neon-title mt-2 text-2xl font-black">レジ画面</h1>
          <p className="mt-2 text-sm text-slate-300">
            入力欄にカーソルを合わせて、バーコードリーダーでQRコードを読み取ってください。
          </p>
        </header>

        <section className="mt-4 rounded-2xl border border-cyan-300/25 bg-slate-900/65 p-4">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-cyan-200/80">スキャン入力</p>
          <form onSubmit={handleImport} className="mt-3 space-y-3">
            <input
              ref={scanInputRef}
              type="text"
              value={rawQrText}
              onChange={(event) => setRawQrText(event.target.value)}
              placeholder="V1M1Q2M3Q1"
              className="w-full rounded-xl border border-cyan-300/30 bg-slate-950/70 px-3 py-3 text-sm text-cyan-100 outline-none"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="rounded-xl border border-cyan-300/40 bg-cyan-300/12 px-4 py-2 text-sm font-bold text-cyan-100"
              >
                読み込む
              </button>
              <button
                type="button"
                onClick={resetScan}
                className="rounded-xl border border-fuchsia-300/40 px-4 py-2 text-sm font-bold text-fuchsia-100"
              >
                リセット
              </button>
            </div>
          </form>

          <p className="mt-3 text-xs text-slate-400">
            QRの中身は英数字のみです。スキャナが Enter を送る設定なら、そのまま確定できます。
          </p>
        </section>

        {scanError && (
          <div className="mt-4 rounded-2xl border border-rose-300/40 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
            {scanError}
          </div>
        )}

        {createdOrder && (
          <section className="mt-4 rounded-2xl border border-emerald-300/35 bg-emerald-300/10 p-4 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-100/80">
              注文登録完了
            </p>
            <p className="mt-2 text-5xl font-black text-white">{createdOrder.num}</p>
            <p className="mt-2 text-sm text-emerald-100">この番号で呼び出してください。</p>
          </section>
        )}

        <section className="mt-4 flex-1 rounded-2xl border border-cyan-300/25 bg-slate-950/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-cyan-200/80">読み取り結果</p>
            <p className="text-sm font-black text-white">¥{total.toLocaleString()}</p>
          </div>

          {scannedItems.length > 0 ? (
            <div className="space-y-2">
              {scannedItems.map((item) => (
                <div key={item.menuId} className="flex items-center justify-between text-sm text-slate-100">
                  <span>
                    {item.name} x {item.qty}
                  </span>
                  <span>¥{(item.price * item.qty).toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-cyan-300/20 bg-slate-900/50 px-3 py-6 text-center text-sm text-slate-400">
              まだQRを読み取っていません
            </div>
          )}

          {hasMissingItems && (
            <p className="mt-3 text-sm text-yellow-200">
              QR内の商品IDに対応する商品が見つからないため、注文登録はできません。
            </p>
          )}

          <button
            onClick={handleCreateOrder}
            disabled={scannedItems.length === 0 || hasMissingItems || isSubmittingOrder}
            className="neon-button mt-4 w-full rounded-2xl px-4 py-4 text-base font-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmittingOrder ? "登録中..." : "会計完了・注文登録"}
          </button>
        </section>
      </div>
    </main>
  );
}
