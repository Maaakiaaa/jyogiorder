"use client";

import { useEffect, useState } from "react";
import { flushPendingOrders } from "@/lib/orders";

// オフラインで確保した注文を、オンライン復帰時・定期的に再送する。
// 通信状況に関わらず番号は既にローカルで発行済みなので、これは「同期」であって
// 番号発行そのものではない(spec: 採番はDBに依存させない)。
export function usePendingSync(): number {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    async function flush() {
      const remaining = await flushPendingOrders();
      setPendingCount(remaining);
    }

    void flush();
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    const timer = setInterval(() => void flush(), 15000);

    return () => {
      window.removeEventListener("online", onOnline);
      clearInterval(timer);
    };
  }, []);

  return pendingCount;
}
