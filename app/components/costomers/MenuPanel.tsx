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
                className="h-[3.25rem] w-[3.25rem] rounded-full border border-cyan-300/45 text-xl font-bold text-cyan-200 disabled:opacity-30"
              >
                −
              </button>
              <span className="w-8 text-center text-sm font-black text-slate-100">{qty}</span>
              <button
                onClick={() => onChangeQty(item.id, 1)}
                className="h-[3.25rem] w-[3.25rem] rounded-full border border-cyan-300/45 text-2xl font-bold text-cyan-200"
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
