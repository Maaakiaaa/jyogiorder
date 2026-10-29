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

  function selectOption(groupId: number, optionId: number) {
    const selectedGroup = availableGroups.find((group) => group.id === groupId);
    const selectedOption = selectedGroup?.options.find((option) => option.id === optionId);
    const dilutionGroup = availableGroups.find((group) => group.name === "割り方");
    setSelectedByGroup((previous) => {
      const next = { ...previous, [groupId]: optionId };
      if (selectedGroup?.name === "温度" && selectedOption?.name === "ホット" && dilutionGroup) {
        delete next[dilutionGroup.id];
      }
      return next;
    });
  }

  function isColdSelected() {
    const temperatureGroup = availableGroups.find((group) => group.name === "温度");
    const selected = temperatureGroup?.options.find((option) => option.id === selectedByGroup[temperatureGroup.id]);
    return selected?.name === "アイス" || selected?.name === "コールド";
  }

  function groupsToAsk() {
    const temperatureGroup = availableGroups.find((group) => group.name === "温度");
    if (!temperatureGroup) return availableGroups;
    if (temperatureGroup.required && selectedByGroup[temperatureGroup.id] === undefined) return [temperatureGroup];
    return availableGroups.filter((group) => group.name !== "温度" && group.name !== "割り方");
  }

  const isComplete = availableGroups.every((group) => {
    if (group.name === "割り方") return menuItem.name === "ゆず茶" || !isColdSelected() || selectedByGroup[group.id] !== undefined;
    return !group.required || selectedByGroup[group.id] !== undefined;
  });

  function handleConfirm() {
    if (!isComplete) return;
    const selected = availableGroups
      .map((group) => group.options.find((option) => option.id === selectedByGroup[group.id]))
      .filter((option): option is MenuOption => option !== undefined);
    if (menuItem.name === "ゆず茶" && isColdSelected()) {
      const dilutionGroup = availableGroups.find((group) => group.name === "割り方");
      const sodaOption = dilutionGroup?.options.find((option) => option.name === "ソーダ割り" && option.isAvailable && option.isActive);
      if (sodaOption) selected.push(sodaOption);
    }
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
          {groupsToAsk().map((group) => (
            <section key={group.id} className="rounded-2xl border border-line bg-canvas p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-black text-ink">
                  {group.name === "温度" ? "ホットかアイスかを選択" : group.name}
                </p>
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
                      <span className="block">
                        {menuItem.name === "ゆず茶" && option.name === "アイス"
                          ? "アイス（ゆずソーダ）"
                          : option.name === "コールド" ? "アイス" : option.name}
                      </span>
                      <span className="mt-1 block text-xs font-medium">
                        {option.priceDelta > 0 ? `+¥${option.priceDelta}` : option.priceDelta < 0 ? `-¥${Math.abs(option.priceDelta)}` : ""}
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
