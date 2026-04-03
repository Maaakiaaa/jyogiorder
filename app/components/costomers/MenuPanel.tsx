"use client";

import { MENU_ITEMS } from "@/lib/menu";
import { CartItem } from "@/types";

interface Props {
  cart: CartItem[];
  onChangeQty: (id: number, delta: number) => void;
}

export default function MenuPanel({ cart, onChangeQty }: Props) {
  function getQty(id: number) {
    return cart.find((c) => c.menuItem.id === id)?.qty ?? 0;
  }

  return (
    <div className="space-y-4 px-3 py-2">
      {MENU_ITEMS.map((item: any) => {
        const qty = getQty(item.id);
        const isYakisoba = item.name.includes("やきそば");

        if (isYakisoba) {
          return (
            <article
              key={item.id}
              className="overflow-hidden rounded-[24px] border border-cyan-300/40 bg-slate-900/65 shadow-[0_0_34px_rgba(46,242,255,0.32)]"
            >
              <img
                src="https://images.unsplash.com/photo-1617093727343-374698b1b08d?auto=format&fit=crop&w=1400&q=80"
                alt="焼きそば"
                className="h-44 w-full object-cover"
              />
              <div className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <p className="neon-title text-2xl font-black text-cyan-200">YAKISOBA</p>
                  <span className="rounded-full border border-yellow-300/60 bg-yellow-300/10 px-3 py-1 text-xs font-bold text-yellow-200 glow-yellow">焼きそば</span>
                </div>
                <p className="text-sm text-slate-200/90">ソース香る鉄板焼き。文化祭の定番人気メニュー。</p>
                <p className="text-2xl font-black text-white">¥{item.price}</p>

                <button
                  onClick={() => onChangeQty(item.id, 1)}
                  className="neon-button w-full rounded-2xl px-4 py-6 text-xl font-black transition-all"
                >
                  カートに追加
                </button>

                <div className="flex items-center justify-center gap-3 rounded-xl bg-slate-950/55 py-2">
                  <button
                    onClick={() => onChangeQty(item.id, -1)}
                    disabled={qty === 0}
                    className="h-12 w-12 rounded-full border border-cyan-300/45 text-2xl font-black text-cyan-200 disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-lg font-black text-cyan-100">{qty}</span>
                  <button
                    onClick={() => onChangeQty(item.id, 1)}
                    className="h-12 w-12 rounded-full border border-cyan-300/45 text-2xl font-black text-cyan-200"
                  >
                    +
                  </button>
                </div>
              </div>
            </article>
          );
        }

        return (
          <article
            key={item.id}
            className="glass-panel flex items-center justify-between rounded-2xl px-4 py-4"
          >
            <div>
              <p className="text-base font-bold text-slate-100">
                {item.emoji} {item.name}
              </p>
              <p className="mt-1 text-sm font-semibold text-cyan-200">¥{item.price}</p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-slate-900/65 px-2 py-1">
              <button
                onClick={() => onChangeQty(item.id, -1)}
                disabled={qty === 0}
                className="h-11 w-11 rounded-full border border-cyan-300/45 text-xl font-bold text-cyan-200 disabled:opacity-30"
              >
                −
              </button>
              <span className="w-5 text-center text-sm font-black text-slate-100">{qty}</span>
              <button
                onClick={() => onChangeQty(item.id, 1)}
                className="h-11 w-11 rounded-full border border-cyan-300/45 text-xl font-bold text-cyan-200"
              >
                +
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
