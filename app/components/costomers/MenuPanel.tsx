"use client";

import { CartItem, MenuItem } from "@/types";

interface Props {
  menu: MenuItem[];
  cart: CartItem[];
  onChangeQty: (id: number, delta: number) => void;
}

export default function MenuPanel({ menu, cart, onChangeQty }: Props) {
  function getQty(id: number) {
    return cart.find((c) => c.menuItem.id === id)?.qty ?? 0;
  }

  return (
    <div className="space-y-4 px-3 py-2">
      {menu.map((item) => {
        const qty = getQty(item.id);
        const isSoldout = !item.available;

        return (
          <article
            key={item.id}
            className={`glass-panel relative flex items-center justify-between rounded-2xl px-4 py-4 ${
              isSoldout ? "opacity-50" : ""
            }`}
          >
            {isSoldout && (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-slate-900/70">
                <p className="w-full text-center text-lg font-bold text-slate-100">SOLD OUT</p>
              </div>
            )}

            <div>
              <p className="text-base font-bold text-slate-100">
                {item.emoji} {item.name}
              </p>
              <p className="mt-1 text-sm font-semibold text-cyan-200">¥{item.price}</p>
            </div>

            <div className="flex items-center gap-2 rounded-full bg-slate-900/65 px-2 py-1">
              <button
                onClick={() => onChangeQty(item.id, -1)}
                disabled={qty === 0 || isSoldout}
                className="h-[3.25rem] w-[3.25rem] rounded-full border border-cyan-300/45 text-xl font-bold text-cyan-200 disabled:opacity-30"
              >
                −
              </button>
              <span className="w-8 text-center text-sm font-black text-slate-100">{qty}</span>
              <button
                onClick={() => onChangeQty(item.id, 1)}
                disabled={isSoldout}
                className="h-[3.25rem] w-[3.25rem] rounded-full border border-cyan-300/45 text-2xl font-bold text-cyan-200 disabled:opacity-30"
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
