import { OrderPrefix } from "@/types";

const STORAGE_KEY_PREFIX = "jyogi:order-seq:";

function storageKey(prefix: OrderPrefix): string {
  return `${STORAGE_KEY_PREFIX}${prefix}`;
}

function formatNumber(prefix: OrderPrefix, seq: number): string {
  return `${prefix}-${String(seq).padStart(2, "0")}`;
}

// 現在の採番位置を確認するだけで、消費(保存)はしない。表示用。
export function peekNextNumber(prefix: OrderPrefix): string {
  const raw = localStorage.getItem(storageKey(prefix));
  const current = raw ? Number.parseInt(raw, 10) : 0;
  const next = (Number.isFinite(current) ? current : 0) + 1;
  return formatNumber(prefix, next);
}

// 番号を1つ消費して発行する。リロード後の巻き戻りによる二重採番を防ぐため、
// 発行直後に必ず localStorage へ書き込む(呼び出し元での保存忘れが最も壊れやすい急所)。
export function issueNextNumber(prefix: OrderPrefix): { seq: number; number: string } {
  const raw = localStorage.getItem(storageKey(prefix));
  const current = raw ? Number.parseInt(raw, 10) : 0;
  const seq = (Number.isFinite(current) ? current : 0) + 1;
  localStorage.setItem(storageKey(prefix), String(seq));
  return { seq, number: formatNumber(prefix, seq) };
}
