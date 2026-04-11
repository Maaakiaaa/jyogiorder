import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 bg-gray-50">
      <h1 className="text-2xl font-semibold text-gray-800">🎪 文化祭モバイルオーダー</h1>
      <p className="text-sm text-gray-500">利用する画面を選んでください</p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/customer"
          className="block text-center bg-blue-600 text-white rounded-xl py-5 font-medium text-lg hover:bg-blue-700 transition"
        >
          🛍️ お客さん画面
        </Link>
        <Link
          href="/admin"
          className="block text-center bg-green-600 text-white rounded-xl py-5 font-medium text-lg hover:bg-green-700 transition"
        >
          🗂️ 管理者画面
        </Link>
        <Link
          href="/cashier"
          className="block text-center bg-amber-600 text-white rounded-xl py-5 font-medium text-lg hover:bg-amber-700 transition"
        >
          💵 レジ画面
        </Link>
        <Link
          href="/display"
          className="block text-center bg-gray-700 text-white rounded-xl py-5 font-medium text-lg hover:bg-gray-800 transition"
        >
          📺 呼び出し画面
        </Link>
      </div>
    </main>
  );
}
