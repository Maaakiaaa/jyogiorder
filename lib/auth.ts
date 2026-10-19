import { supabase } from "./supabase";

export type AppRole = "admin" | "staff";

const ROLE_SESSION_KEY = "jyogi:auth-role";

export function getCachedRole(): AppRole | null {
  if (typeof window === "undefined") return null;
  const role = window.sessionStorage.getItem(ROLE_SESSION_KEY);
  return role === "admin" || role === "staff" ? role : null;
}

export function cacheRole(role: AppRole): void {
  window.sessionStorage.setItem(ROLE_SESSION_KEY, role);
}

export function clearCachedRole(): void {
  if (typeof window !== "undefined") window.sessionStorage.removeItem(ROLE_SESSION_KEY);
}

export function roleFromSession(session: { user: { app_metadata?: Record<string, unknown> } } | null): AppRole | null {
  const role = session?.user.app_metadata?.role;
  return role === "admin" || role === "staff" ? role : null;
}

export function isRoleAllowed(role: AppRole | null, allowed: readonly AppRole[]): boolean {
  return role !== null && allowed.includes(role);
}

export async function signInWithRole(email: string, password: string): Promise<AppRole> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const role = roleFromSession(data.session);
  if (!role) {
    await supabase.auth.signOut();
    throw new Error("このアカウントには利用権限がありません");
  }
  cacheRole(role);
  return role;
}

export async function signOutWithRole(): Promise<void> {
  clearCachedRole();
  await supabase.auth.signOut();
}