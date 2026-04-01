"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearCart, getCart, saveCart } from "@/lib/cartStore";
import { CartItem, Product } from "@/lib/types";

type Props = {
  products: Product[];
};

type TabType = "products" | "cart";

export default function ProductList({ products }: Props) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("products");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setCart(getCart());
  }, []);

  function addToCart(product: Product) {
    const existing = cart.find((item) => item.id === product.id);

    const nextCart = existing
      ? cart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      : [
          ...cart,
          {
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: 1,
          },
        ];

    setCart(nextCart);
    saveCart(nextCart);
  }

  function changeQuantity(productId: number, delta: number) {
    const nextCart = cart
      .map((item) =>
        item.id === productId
          ? { ...item, quantity: item.quantity + delta }
          : item
      )
      .filter((item) => item.quantity > 0);

    setCart(nextCart);
    saveCart(nextCart);
  }

  async function submitOrder() {
    if (cart.length === 0) {
      alert("カートが空です");
      return;
    }

    try {
      setIsSubmitting(true);

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cart }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "注文に失敗しました");
        return;
      }

      clearCart();
      setCart([]);
      router.push(`/order-wait/${data.orderId}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  const totalAmount = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );

  const totalCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff8df,_#f5f1e8_45%,_#ebe5db)] pb-36 text-stone-900">
      <div className="mx-auto flex min-h-screen max-w-md flex-col">
        <header className="sticky top-0 z-20 border-b border-white/60 bg-[#f7f1e7]/90 px-4 py-5 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-700">
                Jyogi Order
              </p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-stone-900">
                注文画面
              </h1>
            </div>

            <div className="rounded-2xl bg-stone-900 px-3 py-2 text-right text-white shadow-lg shadow-stone-900/10">
              <p className="text-[11px] uppercase tracking-[0.25em] text-stone-300">
                Cart
              </p>
              <p className="text-lg font-black">{totalCount}点</p>
            </div>
          </div>
        </header>

        <section className="px-4 pb-6 pt-4">
          <div className="rounded-[28px] bg-stone-900 p-4 text-white shadow-xl shadow-stone-900/15">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-amber-200/80">
                  Today&apos;s Menu
                </p>
                <p className="mt-2 text-lg font-bold">
                  下のタブで商品一覧とカートを切り替えられます
                </p>
              </div>
              <div className="rounded-2xl bg-white/12 px-3 py-2 text-right">
                <p className="text-xs text-stone-200">合計金額</p>
                <p className="text-xl font-black">{totalAmount}円</p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex-1 px-4 pb-6">
          {activeTab === "products" ? (
            <div className="space-y-4">
              {products.map((product) => {
                const cartItem = cart.find((item) => item.id === product.id);
                const count = cartItem?.quantity ?? 0;

                return (
                  <article
                    key={product.id}
                    className="overflow-hidden rounded-[28px] border border-white/70 bg-white/95 p-5 shadow-lg shadow-stone-900/5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold tracking-[0.2em] text-amber-800">
                            MENU
                          </span>
                          {count > 0 ? (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              カートに {count} 点
                            </span>
                          ) : null}
                        </div>
                        <h2 className="mt-3 text-xl font-black tracking-tight text-stone-900">
                          {product.name}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-stone-600">
                          {product.description || "文化祭限定のおすすめメニューです。"}
                        </p>
                        <p className="mt-4 text-2xl font-black text-stone-900">
                          {product.price}円
                        </p>
                      </div>

                      <button
                        onClick={() => addToCart(product)}
                        className="shrink-0 rounded-2xl bg-stone-900 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-stone-900/15 transition active:scale-95"
                      >
                        カートに追加
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {cart.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-stone-300 bg-white/80 p-8 text-center shadow-sm">
                  <p className="text-lg font-bold text-stone-900">
                    カートは空です
                  </p>
                  <p className="mt-2 text-sm leading-6 text-stone-500">
                    商品一覧タブから商品を追加すると、ここに内容が表示されます。
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-[26px] border border-white/70 bg-white/95 p-4 shadow-lg shadow-stone-900/5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-base font-black text-stone-900">
                              {item.name}
                            </p>
                            <p className="mt-1 text-sm text-stone-500">
                              {item.price}円 x {item.quantity}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => changeQuantity(item.id, -1)}
                              className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-stone-50 text-lg font-bold text-stone-700"
                            >
                              -
                            </button>
                            <span className="min-w-8 text-center text-base font-black text-stone-900">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => changeQuantity(item.id, 1)}
                              className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-stone-50 text-lg font-bold text-stone-700"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <p className="mt-4 text-right text-sm font-bold text-stone-800">
                          小計 {item.price * item.quantity}円
                        </p>
                      </article>
                    ))}
                  </div>

                  <div className="rounded-[28px] bg-stone-900 p-5 text-white shadow-xl shadow-stone-900/15">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-stone-300">
                        合計
                      </p>
                      <p className="text-3xl font-black">{totalAmount}円</p>
                    </div>

                    <button
                      onClick={submitOrder}
                      disabled={isSubmitting}
                      className="mt-4 w-full rounded-2xl bg-amber-300 px-4 py-3 text-base font-black text-stone-900 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmitting ? "注文を送信中..." : "この内容で注文する"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        <div className="px-4 pb-4">
          <Link
            href="/"
            className="inline-flex rounded-xl border border-white/80 bg-white/80 px-4 py-2 text-sm font-medium text-stone-700 shadow-sm"
          >
            案内画面に戻る
          </Link>
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-4">
        <div className="pointer-events-auto mx-auto max-w-md rounded-[30px] border border-white/70 bg-white/95 p-2 shadow-2xl shadow-stone-900/15 backdrop-blur">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setActiveTab("products")}
              className={`rounded-[22px] px-4 py-3 text-sm font-bold transition ${
                activeTab === "products"
                  ? "bg-stone-900 text-white shadow-lg shadow-stone-900/15"
                  : "bg-transparent text-stone-500"
              }`}
            >
              商品一覧
            </button>

            <button
              onClick={() => setActiveTab("cart")}
              className={`rounded-[22px] px-4 py-3 text-sm font-bold transition ${
                activeTab === "cart"
                  ? "bg-stone-900 text-white shadow-lg shadow-stone-900/15"
                  : "bg-transparent text-stone-500"
              }`}
            >
              カート{totalCount > 0 ? ` (${totalCount})` : ""}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
