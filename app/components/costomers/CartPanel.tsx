"use client";

import { CartItem } from "@/types";

interface Props {
  cart: CartItem[];
  total: number;
  placing: boolean;
  onChangeQty: (id: number, delta: number) => void;
  onPlaceOrder: () => void;
}

export default function CartPanel({ cart, total, placing, onChangeQty, onPlaceOrder }: Props) {
  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-300">
        <p className="text-6xl">🛒</p>
        <p className="mt-3 text-base font-bold">カートは空です</p>
        <p className="mt-1 text-sm text-slate-400">メニューから追加してください</p>
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
              <p className="font-bold text-slate-100">{c.menuItem.emoji} {c.menuItem.name}</p>
              <p className="mt-1 text-sm text-cyan-200">¥{c.menuItem.price} x {c.qty}</p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-slate-950/70 px-2 py-1">
              <button
                onClick={() => onChangeQty(c.menuItem.id, -1)}
                className="h-11 w-11 rounded-full border border-cyan-300/45 text-xl font-bold text-cyan-200"
              >
                −
              </button>
              <span className="w-5 text-center text-sm font-black text-slate-100">{c.qty}</span>
              <button
                onClick={() => onChangeQty(c.menuItem.id, 1)}
                className="h-11 w-11 rounded-full border border-cyan-300/45 text-xl font-bold text-cyan-200"
              >
                +
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="border-t border-cyan-300/20 bg-slate-950/70 px-4 py-4">
        <div className="mb-3 flex items-center justify-between rounded-xl border border-fuchsia-300/30 bg-slate-900/70 px-4 py-3">
          <span className="text-sm font-bold text-fuchsia-200">TOTAL</span>
          <span className="text-2xl font-black text-white">¥{total.toLocaleString()}</span>
        </div>

        <button
          onClick={onPlaceOrder}
          disabled={placing}
          className="neon-button w-full rounded-2xl px-4 py-5 text-lg font-black transition-all disabled:cursor-not-allowed disabled:opacity-60"
        >
          {placing ? "注文送信中..." : "カートを注文する"}
        </button>
      </div>
    </div>
  );
}
