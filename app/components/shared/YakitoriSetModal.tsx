"use client";

import { useState } from "react";
import { MenuItem, YakitoriFlavor, YakitoriSkewerSelection, YakitoriType } from "@/types";

interface Props {
  menuItem: MenuItem;
  flavors: YakitoriFlavor[];
  types: YakitoriType[];
  onConfirm: (selections: YakitoriSkewerSelection[]) => void;
  onCancel: () => void;
}

type SkewerDraft = {
  flavorId: number | null;
  typeId: number | null;
};

export default function YakitoriSetModal({ menuItem, flavors, types, onConfirm, onCancel }: Props) {
  const skewerCount = menuItem.yakitoriSkewerCount ?? 0;
  const [drafts, setDrafts] = useState<SkewerDraft[]>(
    Array.from({ length: skewerCount }, () => ({ flavorId: null, typeId: null }))
  );

  const isComplete = drafts.every((d) => d.flavorId !== null && d.typeId !== null);

  function setFlavor(index: number, flavorId: number) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, flavorId } : d)));
  }

  function setType(index: number, typeId: number) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, typeId } : d)));
  }

  function handleConfirm() {
    if (!isComplete) return;

    const selections: YakitoriSkewerSelection[] = drafts.map((d) => {
      const flavor = flavors.find((f) => f.id === d.flavorId);
      const type = types.find((t) => t.id === d.typeId);
      return {
        flavorId: d.flavorId as number,
        flavorName: flavor?.name ?? "",
        typeId: d.typeId as number,
        typeName: type?.name ?? "",
      };
    });

    onConfirm(selections);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-[28px] border border-line bg-surface p-5 sm:rounded-[28px]">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-sub">串の味・種類を選ぶ</p>
        <h2 className="mt-1 text-xl font-black text-ink">
          {menuItem.emoji ? `${menuItem.emoji} ` : ""}{menuItem.name}
        </h2>
        <p className="mt-1 text-sm text-sub">
          {skewerCount}本分、それぞれの味と種類を選んでください。
        </p>

        <div className="mt-4 space-y-4">
          {drafts.map((draft, index) => (
            <div key={index} className="rounded-2xl border border-line bg-canvas p-3">
              <p className="text-xs font-bold text-sub">{index + 1}本目</p>

              <div className="mt-2 flex flex-wrap gap-2">
                {flavors.map((flavor) => (
                  <button
                    key={flavor.id}
                    onClick={() => setFlavor(index, flavor.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      draft.flavorId === flavor.id
                        ? "border-brand-indigo bg-brand-indigo text-white"
                        : "border-line bg-surface text-sub"
                    }`}
                  >
                    {flavor.name}
                  </button>
                ))}
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {types.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setType(index, type.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      draft.typeId === type.id
                        ? "border-brand-gold bg-brand-gold text-white"
                        : "border-line bg-surface text-sub"
                    }`}
                  >
                    {type.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-2xl border border-line px-4 py-3 text-sm font-bold text-sub"
          >
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isComplete}
            className="neon-button flex-1 rounded-2xl px-4 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            カートに追加
          </button>
        </div>
      </div>
    </div>
  );
}
