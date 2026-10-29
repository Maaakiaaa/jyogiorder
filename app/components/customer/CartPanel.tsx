"use client";

import { CartItem } from "@/types";
import { displayMenuItemName } from "@/lib/menu";
import QuantityStepper from "@/app/components/shared/QuantityStepper";

interface Props {
  cart: CartItem[];
  total: number;
  onChangeQty: (id: number, delta: number) => void;
  onChangeLineQty: (lineId: string, delta: number) => void;
  onRemoveYakitoriSet: (lineId: string) => void;
  onRemoveLine: (item: CartItem) => void;
  isSoldOut: (item: CartItem) => boolean;
  onShowQr: () => void;
}

export default function CartPanel({ cart, total, onChangeQty, onChangeLineQty, onRemoveYakitoriSet, onRemoveLine, isSoldOut, onShowQr }: Props) {
  const hasSoldOut = cart.some(isSoldOut);

  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-sub">
        <p className="text-6xl">🛒</p>
        <p className="mt-3 text-base font-bold text-ink">カートは空です</p>
        <p className="mt-1 text-sm text-sub">メニューから追加してください</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-2">
        {cart.map((c) => {
          const soldOut = isSoldOut(c);
          return (
          <article
            key={c.lineId ?? c.menuItem.id}
            className={`glass-panel flex items-center justify-between rounded-2xl px-3 py-3 ${
              soldOut ? "border-brand-vermilion/60 opacity-70" : c.qty > 0 ? "menu-item-row--selected" : ""
            }`}
          >
            <div>
              {soldOut && (
                <p className="mb-1 inline-block rounded bg-brand-vermilion px-2 py-0.5 text-[11px] font-black text-white">売り切れになりました</p>
              )}
              <p className="font-bold text-ink">{c.menuItem.emoji ? `${c.menuItem.emoji} ` : ""}{displayMenuItemName(c.menuItem, c.options)}</p>
              {c.options && c.options.length > 0 && (
                <p className="mt-1 text-xs font-bold text-brand-indigo">
                  {c.options.map((option) => {
                    const group = c.menuItem.optionGroups.find((entry) => entry.id === option.groupId);
                    return `${group?.name ?? "選択肢"}: ${option.name}`;
                  }).join(" / ")}
                </p>
              )}
              {c.bundleSelections && c.bundleSelections.length > 0 && (
                <p className="mt-1 text-xs font-bold text-brand-indigo">
                  {c.bundleSelections.map((selection) => `${selection.slotName}: ${displayMenuItemName(selection.menuItem, selection.options)}${selection.yakitoriSelections && selection.yakitoriSelections.length > 0 ? `（${selection.yakitoriSelections.map((skewer) => `${skewer.typeName}×${skewer.flavorName}`).join("、")}）` : selection.options.length > 0 ? `（${selection.options.map((option) => option.name).join("、")}）` : ""}`).join(" / ")}
                </p>
              )}
              {c.yakitoriSelections ? (
                <p className="mt-1 text-sm text-sub">
                  ¥{(c.menuItem.price + (c.options ?? []).reduce((sum, option) => sum + option.priceDelta, 0)).toLocaleString()} ・{" "}
                  {c.yakitoriSelections.map((s, i) => `${i + 1}.${s.typeName}×${s.flavorName}`).join("、")}
                </p>
              ) : (
                <p className="mt-1 text-sm text-sub">¥{(c.menuItem.price + (c.options ?? []).reduce((sum, option) => sum + option.priceDelta, 0)).toLocaleString()} x {c.qty}</p>
              )}
            </div>
            {soldOut ? (
              <button
                onClick={() => onRemoveLine(c)}
                className="rounded-full border border-brand-vermilion/40 bg-brand-vermilion/10 px-4 py-2 text-xs font-bold text-brand-vermilion"
              >
                削除
              </button>
            ) : c.yakitoriSelections ? (
              <button
                onClick={() => onRemoveYakitoriSet(c.lineId as string)}
                className="rounded-full border border-brand-vermilion/40 bg-brand-vermilion/10 px-4 py-2 text-xs font-bold text-brand-vermilion"
              >
                削除
              </button>
            ) : ((c.options && c.options.length > 0) || (c.bundleSelections && c.bundleSelections.length > 0)) && c.lineId ? (
              <QuantityStepper
                quantity={c.qty}
                onChange={(delta) => onChangeLineQty(c.lineId as string, delta)}
              />
            ) : (
              <QuantityStepper
                quantity={c.qty}
                onChange={(delta) => onChangeQty(c.menuItem.id, delta)}
              />
            )}
          </article>
          );
        })}
      </div>

      <div className="border-t border-line bg-surface px-4 py-4">
        <div className="mb-3 flex items-center justify-between rounded-xl border border-line bg-canvas px-4 py-3">
          <span className="text-sm font-bold text-sub">TOTAL</span>
          <span className="text-2xl font-black text-ink">¥{total.toLocaleString()}</span>
        </div>

        {hasSoldOut && (
          <p className="mb-3 rounded-xl border border-brand-vermilion/40 bg-brand-vermilion/10 px-3 py-2 text-center text-xs font-bold text-brand-vermilion">
            売り切れになった商品があります。削除してからQRを表示してください。
          </p>
        )}
        <button
          onClick={onShowQr}
          disabled={hasSoldOut}
          className="neon-button inline-flex h-12 w-full items-center justify-center rounded-full px-4 text-sm font-black transition-all disabled:cursor-not-allowed disabled:opacity-50"
        >
          レジ用QRを表示
        </button>
      </div>
    </div>
  );
}
