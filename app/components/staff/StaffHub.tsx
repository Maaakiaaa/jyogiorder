"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ADMIN_PASSWORD,
  getAdminAuthedServerSnapshot,
  isAdminAuthed,
  setAdminAuthed,
  subscribeAdminAuthed,
} from "@/lib/adminAuth";

const LINKS = [
  { href: "/pos/a", emoji: "📷", title: "POS A（読み取り）", desc: "QRコードで会計・番号発行" },
  { href: "/pos/b", emoji: "🧾", title: "POS B（店頭）", desc: "その場で品目選択・会計" },
  { href: "/kitchen", emoji: "🍳", title: "調理ディスプレイ", desc: "受付・調理中の注文一覧" },
  { href: "/board", emoji: "📣", title: "呼び出しボード", desc: "お客様向け番号表示" },
  { href: "/admin", emoji: "⚙️", title: "管理画面", desc: "商品管理・販売実績" },
] as const;

export default function StaffHub() {
  const authed = useSyncExternalStore(subscribeAdminAuthed, isAdminAuthed, getAdminAuthedServerSnapshot);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  function handleLogin() {
    if (input === ADMIN_PASSWORD) {
      setAdminAuthed();
      setError(false);
    } else {
      setError(true);
      setInput("");
    }
  }

  if (!authed) {
    return (
      <main className="min-h-screen bg-canvas px-3 py-3">
        <div className="mx-auto flex min-h-[95vh] w-full max-w-md items-center justify-center rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <div className="w-full rounded-3xl border border-line bg-surface p-6">
            <p className="text-center text-4xl">🔐</p>
            <h1 className="neon-title mt-2 text-center text-2xl text-ink">STAFF LOGIN</h1>
            <p className="mt-2 text-center text-xs text-sub">管理パスワードを入力してください</p>

            <input
              type="password"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="Password"
              className={`mt-5 w-full rounded-xl border bg-canvas px-4 py-3 text-sm outline-none ${
                error ? "border-rose-400 text-rose-700" : "border-line text-ink"
              }`}
              autoFocus
            />

            {error && <p className="mt-2 text-center text-xs text-rose-600">パスワードが違います</p>}

            <button onClick={handleLogin} className="neon-button mt-5 w-full rounded-xl py-4 text-base font-black">
              ログイン
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-canvas px-3 py-3">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sub">STAFF</p>
        <h1 className="neon-title mt-1 text-2xl text-ink">スタッフ用リンク</h1>
        <p className="mt-2 text-sm text-sub">
          各端末で使う画面を開いたら、ホーム画面に追加するかブックマークしておくと以後はここに戻らなくて済みます。
        </p>

        <div className="mt-5 space-y-3">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 rounded-2xl border border-line bg-canvas px-4 py-3 transition hover:border-brand-indigo/40"
            >
              <span className="text-2xl">{link.emoji}</span>
              <span>
                <span className="block text-sm font-black text-ink">{link.title}</span>
                <span className="block text-xs text-sub">{link.desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
