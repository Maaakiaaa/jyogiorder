"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Order = {
  id: number;
  pickup_number: number;
  status: string;
  total_amount: number;
};

type OrderItem = {
  id: number;
  product_name: string;
  quantity: number;
  subtotal: number;
};

type Props = {
  initialOrder: Order;
  initialItems: OrderItem[];
};

function getStatusText(status: string) {
  switch (status) {
    case "received":
      return "受付済み";
    case "preparing":
      return "調理中";
    case "ready":
      return "受け取り可能";
    case "done":
      return "受け取り完了";
    default:
      return status;
  }
}

export default function OrderWaitRealtime({
  initialOrder,
  initialItems,
}: Props) {
  const [order, setOrder] = useState<Order>(initialOrder);
  const router = useRouter();

  useEffect(() => {
    const channel = supabase
      .channel(`order-${initialOrder.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${initialOrder.id}`,
        },
        (payload) => {
          const updated = payload.new as Order;
          setOrder(updated);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [initialOrder.id]);

  useEffect(() => {
    if (order.status !== "done") {
      return;
    }

    const timer = window.setTimeout(() => {
      router.push("/");
    }, 6000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [order.status, router]);

  const statusText = useMemo(() => getStatusText(order.status), [order.status]);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="rounded-2xl bg-white p-6 shadow">
        <h1 className="mb-6 text-2xl font-bold">受け取り待ち画面</h1>

        <p className="text-base text-gray-600">呼び出し番号</p>
        <p className="mb-6 text-5xl font-extrabold">{order.pickup_number}</p>

        <div className="mb-6 rounded-xl border p-4">
          <p className="text-lg">
            現在の状態: <span className="font-bold">{statusText}</span>
          </p>

          {order.status === "ready" && (
            <p className="mt-3 text-lg font-bold text-green-600">
              商品の受け取りが可能です。番号が呼ばれたら受け取り口までお越しください。
            </p>
          )}

          {order.status === "done" && (
            <div className="mt-4 space-y-4 rounded-xl bg-blue-50 p-4">
              <p className="text-lg font-bold text-blue-700">
                受け取りありがとうございました。
              </p>
              <p className="text-sm text-blue-700">
                まもなくトップへ戻ります。すぐ戻る場合は下のボタンを押してください。
              </p>
              <button
                onClick={() => router.push("/")}
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white"
              >
                トップに戻る
              </button>
            </div>
          )}
        </div>

        <div className="rounded-xl border p-4">
          <h2 className="mb-3 text-xl font-semibold">注文内容</h2>
          <div className="space-y-2">
            {initialItems.map((item) => (
              <div key={item.id} className="flex justify-between gap-4">
                <span>
                  {item.product_name} x {item.quantity}
                </span>
                <span>{item.subtotal}円</span>
              </div>
            ))}
          </div>

          <p className="mt-4 text-right text-lg font-bold">
            合計: {order.total_amount}円
          </p>
        </div>
      </div>
    </main>
  );
}
