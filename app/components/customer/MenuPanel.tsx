"use client";

import { useState } from "react";
import { CartItem, MenuItem, YakitoriFlavor, YakitoriSkewerSelection, YakitoriType } from "@/types";
import YakitoriSetModal from "@/app/components/shared/YakitoriSetModal";

interface Props {
  menu: MenuItem[];
  cart: CartItem[];
  yakitoriFlavors: YakitoriFlavor[];
  yakitoriTypes: YakitoriType[];
  onChangeQty: (id: number, delta: number) => void;
  onAddYakitoriSet: (menuItem: MenuItem, selections: YakitoriSkewerSelection[]) => void;
}

export default function MenuPanel({
  menu,
  cart,
  yakitoriFlavors,
  yakitoriTypes,
  onChangeQty,
  onAddYakitoriSet,
}: Props) {
  const [setModalItem, setSetModalItem] = useState<MenuItem | null>(null);

  function getQty(id: number) {
    return cart.find((c) => c.menuItem.id === id)?.qty ?? 0;
  }

  function getSetCount(id: number) {
    return cart.filter((c) => c.menuItem.id === id && c.yakitoriSelections).length;
  }

  return (
    <div className="space-y-4 px-3 py-2">
      {menu.map((item) => {
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
                {item.isYakitoriSet && (
                  <span className="ml-2 text-xs font-bold text-brand-gold">{item.yakitoriSkewerCount}本</span>
                )}
              </p>
              <p className="mt-1 text-sm font-semibold text-brand-indigo">¥{item.price}</p>
            </div>

            {item.isYakitoriSet ? (
              <button
                onClick={() => setSetModalItem(item)}
                disabled={isSoldout}
                className="rounded-xl border border-brand-indigo/40 bg-brand-indigo/10 px-3 py-3 text-xs font-bold text-brand-indigo disabled:opacity-30"
              >
                串を選んで追加
                {getSetCount(item.id) > 0 && <span className="ml-1">({getSetCount(item.id)})</span>}
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-full bg-canvas px-2 py-1">
                <button
                  onClick={() => onChangeQty(item.id, -1)}
                  disabled={getQty(item.id) === 0 || isSoldout}
                  className="h-[3.25rem] w-[3.25rem] rounded-full border border-line text-xl font-bold text-brand-indigo disabled:opacity-30"
                >
                  −
                </button>
                <span className="w-8 text-center text-sm font-black text-ink">{getQty(item.id)}</span>
                <button
                  onClick={() => onChangeQty(item.id, 1)}
                  disabled={isSoldout}
                  className="h-[3.25rem] w-[3.25rem] rounded-full border border-line text-2xl font-bold text-brand-indigo disabled:opacity-30"
                >
                  +
                </button>
              </div>
            )}
          </article>
        );
      })}

      {setModalItem && (
        <YakitoriSetModal
          menuItem={setModalItem}
          flavors={yakitoriFlavors}
          types={yakitoriTypes}
          onCancel={() => setSetModalItem(null)}
          onConfirm={(selections) => {
            onAddYakitoriSet(setModalItem, selections);
            setSetModalItem(null);
          }}
        />
      )}
    </div>
  );
}
