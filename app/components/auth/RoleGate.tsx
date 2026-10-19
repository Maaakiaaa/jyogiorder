"use client";

import { useEffect, useState } from "react";
import { AppRole, getCachedRole, isRoleAllowed, roleFromSession, signInWithRole } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export default function RoleGate({ roles, children }: { roles: readonly AppRole[]; children: React.ReactNode }) {
  const [role, setRole] = useState<AppRole | null>(() => getCachedRole());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const sessionRole = roleFromSession(data.session);
      if (sessionRole) setRole(sessionRole);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogin() {
    setLoading(true);
    setError("");
    try {
      const signedInRole = await signInWithRole(email.trim(), password);
      setRole(signedInRole);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  if (isRoleAllowed(role, roles)) return <>{children}</>;

  return (
    <main className="min-h-screen bg-canvas px-3 py-3">
      <div className="mx-auto flex min-h-[95vh] w-full max-w-md items-center justify-center rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <div className="w-full rounded-3xl border border-line bg-surface p-6">
          <p className="text-center text-4xl">🔐</p>
          <h1 className="neon-title mt-2 text-center text-2xl text-ink">STAFF LOGIN</h1>
          <p className="mt-2 text-center text-xs text-sub">スタッフ用アカウントでログインしてください</p>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            className="mt-5 w-full rounded-xl border border-line bg-canvas px-4 py-3 text-sm text-ink outline-none"
            autoComplete="username"
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && void handleLogin()}
            placeholder="Password"
            className="mt-3 w-full rounded-xl border border-line bg-canvas px-4 py-3 text-sm text-ink outline-none"
            autoComplete="current-password"
          />
          {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-center text-xs text-rose-700">{error}</p>}
          <button onClick={() => void handleLogin()} disabled={loading} className="neon-button mt-5 w-full rounded-xl py-4 text-base font-black disabled:opacity-50">
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </div>
      </div>
    </main>
  );
}