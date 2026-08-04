// /admin と /staff で共通のパスワード・セッション状態。
// 一度どちらかでログインすれば、同じタブ内ではもう一方も再入力なしで通す。
export const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "1234";
export const ADMIN_AUTH_SESSION_KEY = "admin_authed";

type Listener = () => void;
const listeners = new Set<Listener>();

export function isAdminAuthed(): boolean {
  return sessionStorage.getItem(ADMIN_AUTH_SESSION_KEY) === "true";
}

export function setAdminAuthed(): void {
  sessionStorage.setItem(ADMIN_AUTH_SESSION_KEY, "true");
  listeners.forEach((listener) => listener());
}

export function clearAdminAuthed(): void {
  sessionStorage.removeItem(ADMIN_AUTH_SESSION_KEY);
  listeners.forEach((listener) => listener());
}

// useSyncExternalStore用: sessionStorageという外部システムを、setState-in-effectを
// 使わずに安全に(SSR時はgetServerSnapshotでfalseを返し、ハイドレーション後に同期)購読する。
export function subscribeAdminAuthed(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAdminAuthedServerSnapshot(): boolean {
  return false;
}
