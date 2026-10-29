"use client";

// 前のお客様の番号が次の接客中まで残ると取り違えの元になるため、発行した番号は画面全体で示し、
// お客様に渡した(伝えた)ことを店員がボタンで確定してから次の会計に進む(自動では消さない)。
export default function IssuedNumberOverlay({
  number,
  instruction,
  buttonLabel,
  onNext,
}: {
  number: string;
  instruction: string;
  buttonLabel: string;
  onNext: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <section className="w-full max-w-md rounded-[28px] border-[3px] border-emerald-400 bg-emerald-50 p-6 text-center">
        <p className="text-sm font-bold tracking-[0.16em] text-emerald-700">会計完了・番号発行</p>
        <p className="mt-3 whitespace-nowrap text-7xl font-black tabular-nums text-ink">{number}</p>
        <p className="mt-3 text-base font-bold text-emerald-800">{instruction}</p>
        <button
          type="button"
          onClick={onNext}
          className="neon-button mt-6 w-full rounded-2xl px-4 py-4 text-base font-black"
        >
          {buttonLabel}
        </button>
      </section>
    </div>
  );
}
