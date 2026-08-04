"use client";

interface Props {
  onReset: () => void;
}

export default function WelcomePanel({ onReset }: Props) {
  return (
    <main className="festival-bg min-h-screen px-3 py-3">
      <div className="relative z-10 mx-auto flex min-h-[95vh] w-full max-w-md items-center justify-center rounded-[28px] glass-panel p-6">
        <div className="w-full rounded-3xl border border-line bg-canvas p-8 text-center">
          <p className="text-6xl animate-bounce-in">🎉</p>
          <h1 className="neon-title mt-4 text-2xl text-ink">THANK YOU</h1>
          <p className="mt-3 text-sm text-sub">ご利用ありがとうございました。<br />またのお越しをお待ちしています。</p>

          <button
            onClick={onReset}
            className="neon-button mt-8 w-full rounded-2xl px-4 py-5 text-lg font-black transition-all"
          >
            最初に戻る
          </button>
        </div>
      </div>
    </main>
  );
}
