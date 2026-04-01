"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { getOrderStatusLabel } from "@/lib/orderStatus";

type Order = {
  id: number;
  pickup_number: number;
  total_amount: number;
  status: string;
  created_at: string;
};

type Props = {
  orders: Order[];
};

export default function AdminOrdersList({ orders }: Props) {
  const [showDoneOrders, setShowDoneOrders] = useState(false);

  const visibleOrders = useMemo(() => {
    return showDoneOrders
      ? orders
      : orders.filter((order) => order.status !== "done");
  }, [orders, showDoneOrders]);

  const activeCount = orders.filter((order) => order.status !== "done").length;
  const doneCount = orders.length - activeCount;

  return (
    <main className="p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">注文一覧</h1>
          <p className="mt-1 text-sm text-gray-600">
            進行中の注文を優先して表示しています。
          </p>
        </div>

        <div className="rounded-xl border bg-white p-3 text-sm shadow-sm">
          <p>進行中: {activeCount}件</p>
          <p>完了済み: {doneCount}件</p>
        </div>
      </div>

      <label className="mb-5 flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm">
        <input
          type="checkbox"
          checked={showDoneOrders}
          onChange={(event) => setShowDoneOrders(event.target.checked)}
          className="h-4 w-4"
        />
        <span className="text-sm font-medium text-gray-700">
          完了済みの注文も表示する
        </span>
      </label>

      {visibleOrders.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-white p-8 text-center text-gray-600 shadow-sm">
          表示対象の注文はありません。
        </div>
      ) : (
        <div className="space-y-4">
          {visibleOrders.map((order) => (
            <div
              key={order.id}
              className="rounded-xl border bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-lg font-bold">
                    呼び出し番号: {order.pickup_number}
                  </p>
                  <p>合計金額: {order.total_amount}円</p>
                  <p>状態: {getOrderStatusLabel(order.status)}</p>
                  <p className="text-sm text-gray-500">注文ID: {order.id}</p>
                </div>

                <Link
                  href={`/admin/orders/${order.id}`}
                  className="inline-block rounded bg-black px-4 py-2 text-white"
                >
                  詳細を見る
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
