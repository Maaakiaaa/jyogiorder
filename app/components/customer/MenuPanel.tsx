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
        const isSoldout = !item.isAvailable;

        return (
          <article
            key={item.id}
            className={`glass-panel relative flex items-center justify-between rounded-2xl px-4 py-4 ${
              isSoldout ? "opacity-60" : ""
            }`}
          >
            {isSoldout && (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-surface/80">
                <p className="w-full text-center text-lg font-bold text-ink">SOLD OUT</p>
              </div>
            )}

            <div>
              <p className="text-base font-bold text-ink">
                {item.emoji ? `${item.emoji} ` : ""}{item.name}
              </p>
              <p className="mt-1 text-sm font-semibold text-brand-indigo">¥{item.price}</p>
            </div>

            <div className="flex items-center gap-2 rounded-full bg-canvas px-2 py-1">
              <button
                onClick={() => onChangeQty(item.id, -1)}
                disabled={qty === 0 || isSoldout}
                className="h-[3.25rem] w-[3.25rem] rounded-full border border-line text-xl font-bold text-brand-indigo disabled:opacity-30"
              >
                −
              </button>
              <span className="w-8 text-center text-sm font-black text-ink">{qty}</span>
              <button
                onClick={() => onChangeQty(item.id, 1)}
                disabled={isSoldout}
                className="h-[3.25rem] w-[3.25rem] rounded-full border border-line text-2xl font-bold text-brand-indigo disabled:opacity-30"
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
