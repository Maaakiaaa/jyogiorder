"use client";

import { useState } from "react";
import { BundleSelection, CartItem, MenuItem, MenuOption, YakitoriFlavor, YakitoriSkewerSelection, YakitoriType } from "@/types";
import YakitoriSetModal from "@/app/components/shared/YakitoriSetModal";
import MenuOptionsModal from "@/app/components/shared/MenuOptionsModal";
import BundleSetModal from "@/app/components/shared/BundleSetModal";

interface Props {
  menu: MenuItem[];
  cart: CartItem[];
  yakitoriFlavors: YakitoriFlavor[];
  yakitoriTypes: YakitoriType[];
  onChangeQty: (id: number, delta: number) => void;
  onAddItem: (menuItem: MenuItem, options?: MenuOption[]) => void;
  onAddYakitoriSet: (menuItem: MenuItem, selections: YakitoriSkewerSelection[], options?: MenuOption[]) => void;
  onAddBundleSet: (menuItem: MenuItem, selections: BundleSelection[]) => void;
}

export default function MenuPanel({
  menu,
  cart,
  yakitoriFlavors,
  yakitoriTypes,
  onChangeQty,
  onAddItem,
  onAddYakitoriSet,
  onAddBundleSet,
}: Props) {
  const [setModalItem, setSetModalItem] = useState<MenuItem | null>(null);
  const [optionsModalItem, setOptionsModalItem] = useState<MenuItem | null>(null);
  const [bundleModalItem, setBundleModalItem] = useState<MenuItem | null>(null);
  const [pendingOptions, setPendingOptions] = useState<MenuOption[] | undefined>();
  const [activeTag, setActiveTag] = useState<"yakitori" | "drink">("yakitori");

  function getQty(id: number) {
    return cart.find((c) => c.menuItem.id === id)?.qty ?? 0;
  }

  function getSetCount(id: number) {
    return cart.filter((c) => c.menuItem.id === id && c.yakitoriSelections).length;
  }

  function isOptionSoldout(item: MenuItem) {
    return !item.isAvailable || !item.isActive || item.optionGroups.some(
      (group) => group.required && group.options.every((option) => !option.isAvailable || !option.isActive)
    );
  }

  function isBundleSoldout(item: MenuItem) {
    return item.bundleSlots.some((slot) => slot.candidateItems.length === 0 || slot.candidateItems.every(isOptionSoldout));
  }

  const visibleMenu = menu.filter((item) => activeTag === "drink" ? item.categoryName === "ドリンク" : item.categoryName !== "ドリンク");

  return (
    <div className="space-y-4 px-3 py-2">
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-line bg-canvas p-1">
        <button
          type="button"
          onClick={() => setActiveTag("yakitori")}
          className={`rounded-xl px-3 py-3 text-sm font-black ${activeTag === "yakitori" ? "bg-brand-indigo text-white" : "text-sub"}`}
        >
          焼き鳥
        </button>
        <button
          type="button"
          onClick={() => setActiveTag("drink")}
          className={`rounded-xl px-3 py-3 text-sm font-black ${activeTag === "drink" ? "bg-brand-gold text-white" : "text-sub"}`}
        >
          ドリンク
        </button>
      </div>

      {visibleMenu.map((item) => {
        const isSoldout = !item.isAvailable || isOptionSoldout(item) || (item.isSet && isBundleSoldout(item));
        const hasOptions = item.optionGroups.length > 0;

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

            {item.isSet ? (
              <button
                onClick={() => setBundleModalItem(item)}
                disabled={isSoldout}
                className="rounded-xl border border-brand-indigo/40 bg-brand-indigo/10 px-3 py-3 text-xs font-bold text-brand-indigo disabled:opacity-30"
              >
                セット内容を選ぶ
              </button>
            ) : item.isYakitoriSet ? (
              <button
                onClick={() => {
                  if (hasOptions) {
                    setOptionsModalItem(item);
                  } else {
                    setSetModalItem(item);
                  }
                }}
                disabled={isSoldout}
                className="rounded-xl border border-brand-indigo/40 bg-brand-indigo/10 px-3 py-3 text-xs font-bold text-brand-indigo disabled:opacity-30"
              >
                {hasOptions ? "選択して追加" : "串を選んで追加"}
                {getSetCount(item.id) > 0 && <span className="ml-1">({getSetCount(item.id)})</span>}
              </button>
            ) : hasOptions ? (
              <button
                onClick={() => setOptionsModalItem(item)}
                disabled={isSoldout}
                className="rounded-xl border border-brand-indigo/40 bg-brand-indigo/10 px-3 py-3 text-xs font-bold text-brand-indigo disabled:opacity-30"
              >
                選択して追加
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
          onCancel={() => {
            setSetModalItem(null);
            setPendingOptions(undefined);
          }}
          onConfirm={(selections) => {
            onAddYakitoriSet(setModalItem, selections, pendingOptions);
            setPendingOptions(undefined);
            setSetModalItem(null);
          }}
        />
      )}

      {optionsModalItem && (
        <MenuOptionsModal
          menuItem={optionsModalItem}
          onCancel={() => {
            setOptionsModalItem(null);
            setPendingOptions(undefined);
          }}
          onConfirm={(options) => {
            if (optionsModalItem.isYakitoriSet) {
              setPendingOptions(options);
              setOptionsModalItem(null);
              setSetModalItem(optionsModalItem);
              return;
            }
            onAddItem(optionsModalItem, options);
            setOptionsModalItem(null);
          }}
        />
      )}

      {bundleModalItem && (
        <BundleSetModal
          menuItem={bundleModalItem}
          flavors={yakitoriFlavors}
          types={yakitoriTypes}
          onCancel={() => setBundleModalItem(null)}
          onConfirm={(selections) => {
            onAddBundleSet(bundleModalItem, selections);
            setBundleModalItem(null);
          }}
        />
      )}
    </div>
  );
}
