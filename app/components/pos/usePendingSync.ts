"use client";

import { useEffect, useRef, useState } from "react";
import { listPendingOrders } from "@/lib/offlineQueue";
import { flushPendingOrders } from "@/lib/orders";

// オフラインで確保した注文を、オンライン復帰時・定期的に再送する。
// 通信状況に関わらず番号は既にローカルで発行済みなので、これは「同期」であって
// 番号発行そのものではない(spec: 採番はDBに依存させない)。
const QUEUE_CHANGED_EVENT = "jyogi:pending-orders-changed";
const MAX_RETRY_DELAY_MS = 30000;

export type PendingSyncState = {
  pendingCount: number;
  lastError: string | null;
};

function retryDelay(attempts: number): number {
  return Math.min(2000 * 2 ** Math.max(attempts - 1, 0), MAX_RETRY_DELAY_MS);
}

export function usePendingSync(): PendingSyncState {
  const [state, setState] = useState<PendingSyncState>({ pendingCount: 0, lastError: null });
  const flushInFlight = useRef<Promise<void> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function refreshState() {
      const queue = listPendingOrders();
      const latest = queue
        .filter((order) => order.lastError)
        .sort((a, b) => b.attempts - a.attempts)[0];
      setState({ pendingCount: queue.length, lastError: latest?.lastError ?? null });
      return queue;
    }

    function scheduleRetry() {
      const queue = refreshState();
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (queue.length === 0) return;

      const delay = Math.min(...queue.map((order) => retryDelay(order.attempts)));
      retryTimer.current = setTimeout(() => {
        retryTimer.current = null;
        void flush();
      }, delay);
    }

    async function flush() {
      if (flushInFlight.current) return flushInFlight.current;
      const operation = (async () => {
        if (retryTimer.current) {
          clearTimeout(retryTimer.current);
          retryTimer.current = null;
        }
        await flushPendingOrders();
        scheduleRetry();
      })();
      flushInFlight.current = operation;
      try {
        await operation;
      } finally {
        flushInFlight.current = null;
      }
    }

    function onQueueChanged(event: Event) {
      const detail = (event as CustomEvent<{ reason?: string; triggerSync?: boolean }>).detail;
      const reason = detail?.reason;
      if (reason === "enqueue" && detail?.triggerSync !== false) {
        void flush();
      } else if (reason === "enqueue") {
        refreshState();
      } else if (reason === "failure") {
        scheduleRetry();
      } else {
        refreshState();
      }
    }

    const onOnline = () => void flush();
    window.addEventListener(QUEUE_CHANGED_EVENT, onQueueChanged);
    window.addEventListener("online", onOnline);
    refreshState();
    void flush();

    return () => {
      window.removeEventListener(QUEUE_CHANGED_EVENT, onQueueChanged);
      window.removeEventListener("online", onOnline);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  return state;
}
