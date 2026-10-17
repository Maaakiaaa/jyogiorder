"use client";

import { useState } from "react";
import { MenuItem, MenuOption } from "@/types";

interface Props {
  menuItem: MenuItem;
  onConfirm: (options: MenuOption[]) => void;
  onCancel: () => void;
}

export default function MenuOptionsModal({ menuItem, onConfirm, onCancel }: Props) {
  const [selectedByGroup, setSelectedByGroup] = useState<Record<number, number>>({});
  const availableGroups = menuItem.optionGroups;
  const isComplete = availableGroups.every((group) => !group.required || selectedByGroup[group.id] !== undefined);

  function selectOption(groupId: number, optionId: number) {
    setSelectedByGroup((previous) => ({ ...previous, [groupId]: optionId }));
  }

  function handleConfirm() {
    if (!isComplete) return;
    const selected = availableGroups
      .map((group) => group.options.find((option) => option.id === selectedByGroup[group.id]))
      .filter((option): option is MenuOption => option !== undefined);
    onConfirm(selected);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-[28px] border border-line bg-surface p-5 sm:rounded-[28px]">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-sub">選択肢を選ぶ</p>
        <h2 className="mt-1 text-xl font-black text-ink">
          {menuItem.emoji ? `${menuItem.emoji} ` : ""}{menuItem.name}
        </h2>

        <div className="mt-4 space-y-4">
          {availableGroups.map((group) => (
            <section key={group.id} className="rounded-2xl border border-line bg-canvas p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-black text-ink">{group.name}</p>
                <span className={`text-xs font-bold ${group.required ? "text-brand-vermilion" : "text-sub"}`}>
                  {group.required ? "必須" : "任意"}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {group.options.map((option) => {
                  const disabled = !option.isAvailable || !option.isActive;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => selectOption(group.id, option.id)}
                      disabled={disabled}
                      className={`rounded-xl border px-3 py-2 text-left text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${
                        selectedByGroup[group.id] === option.id
                          ? "border-brand-indigo bg-brand-indigo text-white"
                          : "border-line bg-surface text-sub"
                      }`}
                    >
                      <span className="block">{option.name}</span>
                      <span className="mt-1 block text-xs font-medium">
                        {option.priceDelta > 0 ? `+¥${option.priceDelta}` : option.priceDelta < 0 ? `-¥${Math.abs(option.priceDelta)}` : "価格変更なし"}
                        {disabled ? " ・売り切れ" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
              {group.required && group.options.every((option) => !option.isAvailable || !option.isActive) && (
                <p className="mt-2 text-xs font-bold text-brand-vermilion">このグループはすべて売り切れです</p>
              )}
            </section>
          ))}
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-2xl border border-line px-4 py-3 text-sm font-bold text-sub">
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
