"use client";

import { useState } from "react";
import { BundleSelection, MenuItem, MenuOption } from "@/types";

interface Props {
  menuItem: MenuItem;
  onConfirm: (selections: BundleSelection[]) => void;
  onCancel: () => void;
}

function unavailable(item: MenuItem): boolean {
  return !item.isAvailable || !item.isActive || item.optionGroups.some(
    (group) => group.required && group.options.every((option) => !option.isAvailable || !option.isActive)
  );
}

export default function BundleSetModal({ menuItem, onConfirm, onCancel }: Props) {
  const [selectedItems, setSelectedItems] = useState<Record<number, number>>({});
  const [selectedOptions, setSelectedOptions] = useState<Record<number, Record<number, number>>>({});
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);

  function selectItem(slotId: number, item: MenuItem) {
    setSelectedItems((previous) => ({ ...previous, [slotId]: item.id }));
    setSelectedOptions((previous) => ({ ...previous, [slotId]: {} }));
  }

  function selectOption(slotId: number, groupId: number, optionId: number) {
    const selectedItem = menuItem.bundleSlots
      .find((slot) => slot.id === slotId)
      ?.candidateItems.find((item) => item.id === selectedItems[slotId]);
    const selectedGroup = selectedItem?.optionGroups.find((group) => group.id === groupId);
    const selectedOption = selectedGroup?.options.find((option) => option.id === optionId);
    const dilutionGroup = selectedItem?.optionGroups.find((group) => group.name === "割り方");
    setSelectedOptions((previous) => {
      const next = { ...(previous[slotId] ?? {}), [groupId]: optionId };
      if (selectedGroup?.name === "温度" && selectedOption?.name === "ホット" && dilutionGroup) {
        delete next[dilutionGroup.id];
      }
      return { ...previous, [slotId]: next };
    });
  }

  function isCold(item: MenuItem, choices: Record<number, number>) {
    const temperature = item.optionGroups.find((group) => group.name === "温度");
    return temperature
      ? ["アイス", "コールド"].includes(temperature.options.find((option) => option.id === choices[temperature.id])?.name ?? "")
      : false;
  }

  function groupsToAsk(item: MenuItem, choices: Record<number, number>) {
    const temperature = item.optionGroups.find((group) => group.name === "温度");
    if (!temperature) return item.optionGroups;
    if (choices[temperature.id] === undefined) return [temperature];
    return isCold(item, choices)
      ? item.optionGroups.filter((group) => group.name === "割り方")
      : [];
  }

  const selections = menuItem.bundleSlots.map((slot) => {
    const selectedItem = slot.candidateItems.find((item) => item.id === selectedItems[slot.id]);
    if (!selectedItem) return null;
    const choices = selectedOptions[slot.id] ?? {};
    const options = selectedItem.optionGroups
      .map((group) => group.options.find((option) => option.id === choices[group.id]))
      .filter((option): option is MenuOption => option !== undefined);
    return { slotId: slot.id, slotName: slot.name, menuItem: selectedItem, options } satisfies BundleSelection;
  });

  function isSelectionComplete(selection: BundleSelection | null) {
    if (!selection) return false;
    const temperature = selection.menuItem.optionGroups.find((group) => group.name === "温度");
    const isColdSelection = temperature
      ? ["アイス", "コールド"].includes(selection.options.find((option) => option.groupId === temperature.id)?.name ?? "")
      : false;
    return selection.menuItem.optionGroups.every((group) => {
      if (group.name === "割り方" && !isColdSelection) return true;
      return !group.required || selection.options.some((option) => option.groupId === group.id);
    });
  }

  const isComplete = selections.every(isSelectionComplete);

  function handleConfirm() {
    if (!isComplete) return;
    onConfirm(selections as BundleSelection[]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[28px] border border-line bg-surface p-5 sm:rounded-[28px]">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-sub">セット内容を選ぶ</p>
        <h2 className="mt-1 text-xl font-black text-ink">{menuItem.name}</h2>
        <p className="mt-1 text-sm text-sub">セット価格 ¥{menuItem.price.toLocaleString()}（中身の価格差は加算されません）</p>
        <p className="mt-2 text-xs font-bold text-brand-indigo">{activeSlotIndex + 1} / {menuItem.bundleSlots.length}</p>

        <div className="mt-4 space-y-4">
          {menuItem.bundleSlots.slice(activeSlotIndex, activeSlotIndex + 1).map((slot) => {
            const selectedItem = slot.candidateItems.find((item) => item.id === selectedItems[slot.id]);
            const choiceMap = selectedOptions[slot.id] ?? {};
            return (
              <section key={slot.id} className="rounded-2xl border border-line bg-canvas p-3">
                <p className="text-sm font-black text-ink">{slot.name}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {slot.candidateItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      disabled={unavailable(item)}
                      onClick={() => selectItem(slot.id, item)}
                      className={`rounded-xl border px-3 py-2 text-left text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40 ${
                        selectedItems[slot.id] === item.id ? "border-brand-indigo bg-brand-indigo text-white" : "border-line bg-surface text-sub"
                      }`}
                    >
                      <span className="block">{item.name}</span>
                      <span className="mt-1 block text-xs font-medium">{unavailable(item) ? "売り切れ" : `単品 ¥${item.price.toLocaleString()}`}</span>
                    </button>
                  ))}
                </div>

                {selectedItem && groupsToAsk(selectedItem, choiceMap).map((group) => (
                  <div key={group.id} className="mt-3 border-t border-line pt-3">
                    <p className="text-xs font-bold text-sub">
                      {group.name === "温度" ? "最初にホットかアイスかを選択" : group.name === "割り方" ? "次に水割りかソーダ割りを選択" : group.name}
                      {group.required ? "（必須）" : "（任意）"}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {group.options.map((option) => {
                        const disabled = !option.isAvailable || !option.isActive;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            disabled={disabled}
                            onClick={() => selectOption(slot.id, group.id, option.id)}
                            className={`rounded-lg border px-2 py-2 text-left text-xs font-bold disabled:opacity-40 ${
                              choiceMap[group.id] === option.id ? "border-brand-gold bg-brand-gold text-white" : "border-line bg-surface text-sub"
                            }`}
                          >
                            {option.name === "コールド" ? "アイス" : option.name}{disabled ? "（売切）" : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </section>
            );
          })}
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-2xl border border-line px-4 py-3 text-sm font-bold text-sub">キャンセル</button>
          {activeSlotIndex < menuItem.bundleSlots.length - 1 ? (
            <button
              onClick={() => setActiveSlotIndex((index) => index + 1)}
              disabled={!isSelectionComplete(selections[activeSlotIndex] ?? null)}
              className="neon-button flex-1 rounded-2xl px-4 py-3 text-sm font-black disabled:opacity-40"
            >
              次へ
            </button>
          ) : (
            <button onClick={handleConfirm} disabled={!isComplete} className="neon-button flex-1 rounded-2xl px-4 py-3 text-sm font-black disabled:opacity-40">カートに追加</button>
          )}
        </div>
      </div>
    </div>
  );
}
