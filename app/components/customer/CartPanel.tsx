"use client";

import { CartItem } from "@/types";

interface Props {
  cart: CartItem[];
  total: number;
  onChangeQty: (id: number, delta: number) => void;
  onShowQr: () => void;
}

export default function CartPanel({ cart, total, onChangeQty, onShowQr }: Props) {
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
        {cart.map((c) => (
          <article
            key={c.menuItem.id}
            className="glass-panel flex items-center justify-between rounded-2xl px-4 py-3"
          >
            <div>
              <p className="font-bold text-ink">{c.menuItem.emoji ? `${c.menuItem.emoji} ` : ""}{c.menuItem.name}</p>
              <p className="mt-1 text-sm text-sub">¥{c.menuItem.price} x {c.qty}</p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-canvas px-2 py-1">
              <button
                onClick={() => onChangeQty(c.menuItem.id, -1)}
                className="h-11 w-11 rounded-full border border-line text-xl font-bold text-brand-indigo"
              >
                −
              </button>
              <span className="w-8 text-center text-sm font-black text-ink">{c.qty}</span>
              <button
                onClick={() => onChangeQty(c.menuItem.id, 1)}
                className="h-[3.25rem] w-[3.25rem] rounded-full border border-line text-2xl font-bold text-brand-indigo"
              >
                +
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="border-t border-line bg-surface px-4 py-4">
        <div className="mb-3 flex items-center justify-between rounded-xl border border-line bg-canvas px-4 py-3">
          <span className="text-sm font-bold text-sub">TOTAL</span>
          <span className="text-2xl font-black text-ink">¥{total.toLocaleString()}</span>
        </div>

        <button
          onClick={onShowQr}
          className="neon-button inline-flex w-full items-center justify-center rounded-full px-4 py-[1.05rem] text-sm font-black transition-all"
        >
          レジ用QRを表示
        </button>
      </div>
    </div>
  );
}
