"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { fetchMenuItems, fetchYakitoriFlavors, fetchYakitoriTypes } from "@/lib/menu";
import { NewOrderItem, placeOrder } from "@/lib/orders";
import { peekNextNumber } from "@/lib/numbering";
import { parseQrPayload } from "@/lib/qr";
import { usePendingSync } from "@/app/components/pos/usePendingSync";
import { MenuItem, Order, OrderItemYakitoriSelection, QrOrderPayload, YakitoriFlavor, YakitoriType } from "@/types";

type ScannedLineItem = {
  key: string;
  menuId: number;
  name: string;
  price: number;
  qty: number;
  yakitoriSelections?: OrderItemYakitoriSelection[];
};

export default function PosAPage() {
  const scanInputRef = useRef<HTMLInputElement | null>(null);

  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [yakitoriFlavors, setYakitoriFlavors] = useState<YakitoriFlavor[]>([]);
  const [yakitoriTypes, setYakitoriTypes] = useState<YakitoriType[]>([]);
  const [scanError, setScanError] = useState("");
  const [rawQrText, setRawQrText] = useState("");
  const [qrPayload, setQrPayload] = useState<QrOrderPayload | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [nextNumber, setNextNumber] = useState("-");
  const pendingSyncCount = usePendingSync();

  useEffect(() => {
    Promise.all([fetchMenuItems(), fetchYakitoriFlavors(), fetchYakitoriTypes()])
      .then(([items, flavors, types]) => {
        setMenu(items);
        setYakitoriFlavors(flavors);
        setYakitoriTypes(types);
      })
      .catch(() => setScanError("メニュー情報の取得に失敗しました"));
  }, []);

  useEffect(() => {
    scanInputRef.current?.focus();
  }, []);

  useEffect(() => {
    setNextNumber(peekNextNumber("A"));
  }, [confirmedOrder]);

  const { scannedItems, hasMissingItems } = useMemo(() => {
    if (!qrPayload) return { scannedItems: [] as ScannedLineItem[], hasMissingItems: false };

    const merged = new Map<number, ScannedLineItem>();
    const setLines: ScannedLineItem[] = [];
    let missing = false;

    qrPayload.items.forEach((item, index) => {
      const menuItem = menu.find((menuEntry) => menuEntry.id === item.menuId);
      if (!menuItem) {
        missing = true;
        return;
      }

      // 焼き鳥セットは串の選択が異なりうるため、同じ商品IDでもqtyでまとめず1回の購入=1行として扱う。
      if (item.yakitoriSelections) {
        const resolved: OrderItemYakitoriSelection[] = [];
        for (const selection of item.yakitoriSelections) {
          const flavor = yakitoriFlavors.find((f) => f.id === selection.flavorId);
          const type = yakitoriTypes.find((t) => t.id === selection.typeId);
          if (!flavor || !type) {
            missing = true;
            return;
          }
          resolved.push({ flavorName: flavor.name, typeName: type.name });
        }

        setLines.push({
          key: `set-${index}`,
          menuId: item.menuId,
          name: menuItem.name,
          price: menuItem.price,
          qty: item.qty,
          yakitoriSelections: resolved,
        });
        return;
      }

      const current = merged.get(item.menuId) ?? {
        key: `plain-${item.menuId}`,
        menuId: item.menuId,
        name: menuItem.name,
        price: menuItem.price,
        qty: 0,
      };

      current.qty += item.qty;
      merged.set(item.menuId, current);
    });

    return { scannedItems: [...Array.from(merged.values()), ...setLines], hasMissingItems: missing };
  }, [menu, qrPayload, yakitoriFlavors, yakitoriTypes]);

  const total = useMemo(
    () => scannedItems.reduce((sum, item) => sum + item.price * item.qty, 0),
    [scannedItems]
  );

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
        yakitoriSelections: item.yakitoriSelections,
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
        <header className="border-b border-line pb-4">
          <p className="neon-title text-[11px] uppercase tracking-[0.22em] text-sub">
            POS · A
          </p>
          <h1 className="neon-title mt-2 text-2xl text-ink">A端末（読み取り）</h1>
          <p className="mt-2 text-sm text-sub">
            スキャンは内容の確認だけです。番号は支払い完了ボタンを押した瞬間に発行されます。
          </p>
          <p className="mt-1 text-xs text-sub">次に発行される番号: {nextNumber}</p>
          {pendingSyncCount > 0 && (
            <p className="mt-2 rounded-lg border border-brand-gold/40 bg-brand-gold/10 px-3 py-1.5 text-xs font-bold text-brand-gold">
              オフライン: 同期待ち {pendingSyncCount}件（このまま操作を続けてください。復帰次第自動送信します）
            </p>
          )}
        </header>

        <section className="mt-4 rounded-2xl border border-line bg-canvas p-4">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-sub">スキャン入力</p>
          <form onSubmit={handleImport} className="mt-3 space-y-3">
            <input
              ref={scanInputRef}
              type="text"
              value={rawQrText}
              onChange={(event) => setRawQrText(event.target.value)}
              placeholder="V1O..."
              className="w-full rounded-xl border border-line bg-surface px-3 py-3 text-sm text-ink outline-none"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="rounded-xl border border-brand-indigo/40 bg-brand-indigo/10 px-4 py-2 text-sm font-bold text-brand-indigo"
              >
                読み込む
              </button>
              <button
                type="button"
                onClick={resetScan}
                className="rounded-xl border border-line px-4 py-2 text-sm font-bold text-sub"
              >
                リセット
              </button>
            </div>
          </form>

          <p className="mt-3 text-xs text-sub">
            バーコードスキャナがEnterを送る設定なら、そのまま読み込みが確定します。
          </p>
        </section>

        {scanError && (
          <div className="mt-4 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {scanError}
          </div>
        )}

        {confirmedOrder && (
          <section className="mt-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-700">
              会計完了・番号発行
            </p>
            <p className="mt-2 text-5xl font-black text-ink">{confirmedOrder.number}</p>
            <p className="mt-2 text-sm text-emerald-700">この番号で呼び出してください。</p>
          </section>
        )}

        <section className="mt-4 flex-1 rounded-2xl border border-line bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-sub">読み取り結果</p>
            <p className="text-sm font-black text-ink">¥{total.toLocaleString()}</p>
          </div>

          {scannedItems.length > 0 ? (
            <div className="space-y-2">
              {scannedItems.map((item) => (
                <div key={item.key} className="flex items-start justify-between text-sm text-ink">
                  <span>
                    {item.name} x {item.qty}
                    {item.yakitoriSelections && (
                      <span className="block text-xs text-sub">
                        {item.yakitoriSelections
                          .map((s, i) => `${i + 1}.${s.typeName}×${s.flavorName}`)
                          .join("、")}
                      </span>
                    )}
                  </span>
                  <span>¥{(item.price * item.qty).toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-line bg-canvas px-3 py-6 text-center text-sm text-sub">
              まだQRを読み取っていません
            </div>
          )}

          {hasMissingItems && (
            <p className="mt-3 text-sm text-brand-vermilion">
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
