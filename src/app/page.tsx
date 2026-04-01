import Link from "next/link";

const steps = [
  {
    title: "商品を選ぶ",
    description: "人気メニューから好きな商品を選んでカートに入れます。",
  },
  {
    title: "注文番号を受け取る",
    description: "注文後に発行される呼び出し番号をそのまま確認できます。",
  },
  {
    title: "番号が出たら受け取り",
    description: "受け取り可能になったら画面が更新され、そのまま受け取れます。",
  },
];

export default function Page() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff7d6,_#f3ede1_42%,_#e8e0d5)] px-4 py-8 text-stone-900">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-between rounded-[32px] border border-white/70 bg-white/75 p-6 shadow-2xl shadow-stone-900/10 backdrop-blur">
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-700">
            Jyogi Order
          </p>
          <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight">
            ようこそ、
            <br />
            文化祭モバイルオーダーへ
          </h1>
          <p className="mt-4 text-sm leading-7 text-stone-600">
            スマホから注文して、呼び出し番号で受け取れる文化祭用の注文ページです。
            混雑していても、列に並ばずに注文できます。
          </p>
        </section>

        <section className="mt-8 space-y-3">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="rounded-[24px] border border-white/70 bg-stone-50/90 p-4 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-900 text-sm font-black text-white">
                  {index + 1}
                </div>
                <div>
                  <h2 className="text-base font-black">{step.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-stone-600">
                    {step.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="mt-8 space-y-3">
          <Link
            href="/order"
            className="block rounded-[24px] bg-stone-900 px-5 py-4 text-center text-base font-black text-white shadow-lg shadow-stone-900/15"
          >
            注文をはじめる
          </Link>
          <p className="text-center text-xs leading-6 text-stone-500">
            注文後は呼び出し番号の画面が自動で表示されます。
          </p>
        </section>
      </div>
    </main>
  );
}
