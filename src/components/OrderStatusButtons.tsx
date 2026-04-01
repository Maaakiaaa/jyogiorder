"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ORDER_STATUSES,
  OrderStatus,
  getOrderStatusLabel,
} from "@/lib/orderStatus";

type Props = {
  orderId: number;
};

export default function OrderStatusButtons({ orderId }: Props) {
  const router = useRouter();
  const [pendingUndoStatus, setPendingUndoStatus] =
    useState<OrderStatus | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function patchStatus(status: OrderStatus) {
    const res = await fetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || "ステータス更新に失敗しました");
    }
  }

  async function updateStatus(status: OrderStatus) {
    try {
      setIsUpdating(true);
      await patchStatus(status);

      if (status === "done") {
        setPendingUndoStatus("ready");

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          setPendingUndoStatus(null);
          router.refresh();
        }, 8000);

        return;
      }

      setPendingUndoStatus(null);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "ステータス更新に失敗しました";
      alert(message);
    } finally {
      setIsUpdating(false);
    }
  }

  async function undoDone() {
    if (!pendingUndoStatus) {
      return;
    }

    try {
      setIsUpdating(true);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      await patchStatus(pendingUndoStatus);
      setPendingUndoStatus(null);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "ステータス更新に失敗しました";
      alert(message);
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        {ORDER_STATUSES.map((status) => (
          <button
            key={status.value}
            onClick={() => updateStatus(status.value)}
            disabled={isUpdating}
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status.label}
          </button>
        ))}
      </div>

      {pendingUndoStatus ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>
            「受け取り完了」に変更しました。8秒以内なら
            {getOrderStatusLabel(pendingUndoStatus)}
            に戻せます。
          </p>
          <button
            onClick={undoDone}
            disabled={isUpdating}
            className="rounded bg-amber-600 px-3 py-1.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            元に戻す
          </button>
        </div>
      ) : null}
    </div>
  );
}
