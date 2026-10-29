import { OrderPrefix } from "@/types";

const STORAGE_KEY_PREFIX = "jyogi:order-seq:";
const RENUMBER_KEY = "jyogi:renumbered-orders";
const RENUMBER_EVENT = "jyogi:renumbered-orders-changed";

function storageKey(prefix: OrderPrefix): string {
  return `${STORAGE_KEY_PREFIX}${prefix}`;
}

function formatNumber(prefix: OrderPrefix, seq: number): string {
  return `${prefix}-${String(seq).padStart(2, "0")}`;
}

function readCurrentSeq(prefix: OrderPrefix): number {
  const raw = localStorage.getItem(storageKey(prefix));
  const current = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(current) ? current : 0;
}

// 現在の採番位置を確認するだけで、消費(保存)はしない。表示用。
export function peekNextNumber(prefix: OrderPrefix): string {
  return formatNumber(prefix, readCurrentSeq(prefix) + 1);
}

// 番号を1つ消費して発行する。リロード後の巻き戻りによる二重採番を防ぐため、
// 発行直後に必ず localStorage へ書き込む(呼び出し元での保存忘れが最も壊れやすい急所)。
export function issueNextNumber(prefix: OrderPrefix): { seq: number; number: string } {
  const seq = readCurrentSeq(prefix) + 1;
  localStorage.setItem(storageKey(prefix), String(seq));
  return { seq, number: formatNumber(prefix, seq) };
}

// 端末交換・ストレージ消去で採番位置が巻き戻っていた場合に、既に使われた番号まで進める。
// 進めるだけで戻すことはしない(採番の主体はあくまで端末)。
export function ensureSeqAtLeast(prefix: OrderPrefix, seq: number): void {
  if (readCurrentSeq(prefix) < seq) localStorage.setItem(storageKey(prefix), String(seq));
}

// 一度お客様に伝えた番号が重複していて振り直した記録。店員がお客様へ訂正を伝えるまで端末に残す。
export type RenumberNotice = {
  orderId: string;
  prefix: OrderPrefix;
  from: string;
  to: string;
  at: string;
};

export function listRenumberNotices(): RenumberNotice[] {
  try {
    const raw = localStorage.getItem(RENUMBER_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as RenumberNotice[]) : [];
  } catch {
    return [];
  }
}

function writeRenumberNotices(notices: RenumberNotice[]): void {
  localStorage.setItem(RENUMBER_KEY, JSON.stringify(notices));
  window.dispatchEvent(new CustomEvent(RENUMBER_EVENT));
}

export function recordRenumberNotice(notice: RenumberNotice): void {
  writeRenumberNotices([...listRenumberNotices().filter((entry) => entry.orderId !== notice.orderId), notice]);
}

export function dismissRenumberNotice(orderId: string): void {
  writeRenumberNotices(listRenumberNotices().filter((entry) => entry.orderId !== orderId));
}

export function onRenumberNoticesChanged(listener: () => void): () => void {
  window.addEventListener(RENUMBER_EVENT, listener);
  return () => window.removeEventListener(RENUMBER_EVENT, listener);
}
