"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { fetchMenuItems } from "@/lib/menu";
import { NewOrderItem, placeOrder } from "@/lib/orders";
import { peekNextNumber } from "@/lib/numbering";
import { parseQrPayload } from "@/lib/qr";
import { usePendingSync } from "@/app/components/pos/usePendingSync";
import { MenuItem, Order, QrOrderPayload } from "@/types";

type ScannedLineItem = {
  menuId: number;
  name: string;
  price: number;
  qty: number;
};

export default function PosAPage() {
  const scanInputRef = useRef<HTMLInputElement | null>(null);

  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [scanError, setScanError] = useState("");
  const [rawQrText, setRawQrText] = useState("");
  const [qrPayload, setQrPayload] = useState<QrOrderPayload | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [nextNumber, setNextNumber] = useState("-");
  const pendingSyncCount = usePendingSync();

  useEffect(() => {
    fetchMenuItems()
      .then((items) => setMenu(items))
      .catch(() => setScanError("メニュー情報の取得に失敗しました"));
  }, []);

  useEffect(() => {
    scanInputRef.current?.focus();
  }, []);

  useEffect(() => {
    setNextNumber(peekNextNumber("A"));
  }, [confirmedOrder]);

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
    setConfirmedOrder(null);
  }

  function handleImport(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    try {
      handleScanResult(rawQrText);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "QRコードの解析に失敗しました");
    }
  }

  async function handleConfirmPayment() {
    if (!qrPayload || scannedItems.length === 0 || isSubmitting || hasMissingItems) return;

    setIsSubmitting(true);
    try {
      const items: NewOrderItem[] = scannedItems.map((item) => ({
        menuItemId: item.menuId,
        name: item.name,
        price: item.price,
        qty: item.qty,
      }));
      const order = await placeOrder(qrPayload.orderId, "A", items);
      setConfirmedOrder(order);
      setQrPayload(null);
      setRawQrText("");
      setScanError("");
      scanInputRef.current?.focus();
    } catch {
      setScanError("番号発行に失敗しました。もう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetScan() {
    setQrPayload(null);
    setRawQrText("");
    setConfirmedOrder(null);
    setScanError("");
    scanInputRef.current?.focus();
  }

  return (
    <main className="festival-bg min-h-screen px-3 py-3">
      <div className="glass-panel relative z-10 mx-auto flex min-h-[95vh] w-full max-w-md flex-col rounded-[28px] p-4">
        <header className="border-b border-cyan-300/20 pb-4">
          <p className="neon-title text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-200/80">
            POS · A
          </p>
          <h1 className="neon-title mt-2 text-2xl font-black">A端末（読み取り）</h1>
          <p className="mt-2 text-sm text-slate-300">
            スキャンは内容の確認だけです。番号は支払い完了ボタンを押した瞬間に発行されます。
          </p>
          <p className="mt-1 text-xs text-cyan-200/70">次に発行される番号: {nextNumber}</p>
          {pendingSyncCount > 0 && (
            <p className="mt-2 rounded-lg border border-yellow-300/40 bg-yellow-300/10 px-3 py-1.5 text-xs font-bold text-yellow-100">
              オフライン: 同期待ち {pendingSyncCount}件（このまま操作を続けてください。復帰次第自動送信します）
            </p>
          )}
        </header>

        <section className="mt-4 rounded-2xl border border-cyan-300/25 bg-slate-900/65 p-4">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-cyan-200/80">スキャン入力</p>
          <form onSubmit={handleImport} className="mt-3 space-y-3">
            <input
              ref={scanInputRef}
              type="text"
              value={rawQrText}
              onChange={(event) => setRawQrText(event.target.value)}
              placeholder="V1O..."
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
            バーコードスキャナがEnterを送る設定なら、そのまま読み込みが確定します。
          </p>
        </section>

        {scanError && (
          <div className="mt-4 rounded-2xl border border-rose-300/40 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
            {scanError}
          </div>
        )}

        {confirmedOrder && (
          <section className="mt-4 rounded-2xl border border-emerald-300/35 bg-emerald-300/10 p-4 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-100/80">
              会計完了・番号発行
            </p>
            <p className="mt-2 text-5xl font-black text-white">{confirmedOrder.number}</p>
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
              QR内の商品IDに対応する商品が見つからないため、番号発行はできません。
            </p>
          )}

          <button
            onClick={handleConfirmPayment}
            disabled={scannedItems.length === 0 || hasMissingItems || isSubmitting}
            className="neon-button mt-4 w-full rounded-2xl px-4 py-4 text-base font-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "発行中..." : "支払い完了・番号発行"}
          </button>
        </section>
      </div>
    </main>
  );
}
