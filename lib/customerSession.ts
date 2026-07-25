const SESSION_KEY = "jyogi:customer-session";

type CustomerSession = {
  orderIds: string[];
  activeOrderId: string | null;
};

const EMPTY_SESSION: CustomerSession = { orderIds: [], activeOrderId: null };

// お客さん画面はSPA内のReact stateだけで進行を持っていたため、リロード一発で
// 最初の画面(menu)に戻ってしまっていた。会場では誤リロード・スマホの再読み込みが
// 普通に起きるので、支払い確定後の注文IDだけはlocalStorageに退避しておき、
// 再訪時にDBへ問い合わせて状態を復元する。
export function saveCustomerSession(orderIds: string[], activeOrderId: string | null): void {
  if (orderIds.length === 0) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify({ orderIds, activeOrderId }));
}

export function loadCustomerSession(): CustomerSession {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return EMPTY_SESSION;
    const parsed = JSON.parse(raw) as Partial<CustomerSession>;
    if (!Array.isArray(parsed.orderIds)) return EMPTY_SESSION;
    return { orderIds: parsed.orderIds, activeOrderId: parsed.activeOrderId ?? null };
  } catch {
    return EMPTY_SESSION;
  }
}
