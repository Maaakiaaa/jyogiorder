import Link from "next/link";
import RoleGate from "@/app/components/auth/RoleGate";

const LINKS = [
  { href: "/pos/a", emoji: "📷", title: "POS A（読み取り）", desc: "QRコードで会計・番号発行" },
  { href: "/pos/b", emoji: "🧾", title: "POS B（店頭）", desc: "その場で品目選択・会計" },
  { href: "/kitchen", emoji: "🍳", title: "調理ディスプレイ", desc: "受付・調理中の注文一覧" },
  { href: "/board", emoji: "📣", title: "呼び出しボード", desc: "お客様向け番号表示" },
  { href: "/admin", emoji: "⚙️", title: "管理画面", desc: "商品管理・販売実績" },
] as const;

export default function StaffHub() {
  return <RoleGate roles={["staff", "admin"]}>
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
  </RoleGate>;
}
