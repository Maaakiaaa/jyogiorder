"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Order = {
  id: number;
  pickup_number: number;
  status: string;
};

type Props = {
  initialOrders: Order[];
};

export default function ReadyBoard({ initialOrders }: Props) {
  const [readyOrders, setReadyOrders] = useState<Order[]>(initialOrders);

  useEffect(() => {
    const channel = supabase
      .channel("ready-board-orders")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          const newRow = payload.new as Order | Record<string, never>;
          const oldRow = payload.old as Order | Record<string, never>;

          setReadyOrders((prev) => {
            let next = [...prev];

            // INSERT: ready の注文だけ追加
            if (payload.eventType === "INSERT") {
              const inserted = newRow as Order;
              if (inserted.status === "ready") {
                const exists = next.some((o) => o.id === inserted.id);
                if (!exists) next.push(inserted);
              }
            }

            // UPDATE:
            // 1) ready になったら追加
            // 2) ready 以外になったら削除
            // 3) ready のままなら番号情報を更新
            if (payload.eventType === "UPDATE") {
              const updated = newRow as Order;

              if (updated.status === "ready") {
                const exists = next.some((o) => o.id === updated.id);
                if (exists) {
                  next = next.map((o) => (o.id === updated.id ? updated : o));
                } else {
                  next.push(updated);
                }
              } else {
                next = next.filter((o) => o.id !== updated.id);
              }
            }

            // DELETE: 消す
            if (payload.eventType === "DELETE") {
              const deleted = oldRow as Order;
              next = next.filter((o) => o.id !== deleted.id);
            }

            next.sort((a, b) => a.pickup_number - b.pickup_number);
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const numbers = useMemo(
    () => readyOrders.map((order) => order.pickup_number),
    [readyOrders]
  );

  return (
    <main className="min-h-screen bg-neutral-100 p-8">
      <div className="mx-auto max-w-5xl rounded-3xl bg-white p-8 shadow">
        <h1 className="mb-6 text-center text-4xl font-bold">
          受け取り可能な番号
        </h1>

        {numbers.length === 0 ? (
          <p className="py-20 text-center text-2xl text-gray-500">
            まだ完成した注文はありません
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
            {numbers.map((number) => (
              <div
                key={number}
                className="rounded-2xl border bg-green-50 p-8 text-center text-5xl font-extrabold shadow-sm"
              >
                {number}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}