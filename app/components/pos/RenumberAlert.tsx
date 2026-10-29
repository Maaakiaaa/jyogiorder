"use client";

import { dismissRenumberNotice, RenumberNotice } from "@/lib/numbering";

// 一度お客様に伝えた番号が重複していて振り直した注文。訂正を伝え終えるまで消さない。
export default function RenumberAlert({ notices }: { notices: RenumberNotice[] }) {
  if (notices.length === 0) return null;

  return (
    <section className="mt-4 rounded-2xl border-[3px] border-brand-vermilion bg-brand-vermilion/10 p-4">
      <p className="text-base font-black text-brand-vermilion">⚠ 番号が変更されました。お客様に訂正を伝えてください</p>
      <p className="mt-1 text-xs text-sub">
        端末の番号が既に使われた番号と重複していたため、送信時に振り直しました。番号札・口頭で伝えた番号を訂正してください。
      </p>
      <div className="mt-3 space-y-2">
        {notices.map((notice) => (
          <div key={notice.orderId} className="flex items-center justify-between gap-3 rounded-xl border border-brand-vermilion/40 bg-surface px-4 py-3">
            <p className="text-xl font-black text-ink">
              <span className="text-sub line-through">{notice.from}</span>
              <span className="mx-2 text-brand-vermilion">→</span>
              <span>{notice.to}</span>
            </p>
            <button
              type="button"
              onClick={() => dismissRenumberNotice(notice.orderId)}
              className="shrink-0 rounded-xl border border-line bg-canvas px-3 py-2 text-xs font-bold text-sub"
            >
              伝えた
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
