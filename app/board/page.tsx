"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Order } from "@/types";
import { fetchActiveOrders, updateOrderStatus } from "@/lib/orders";
import { createNotificationAudio, playNotificationAudio, unlockNotificationAudio } from "@/lib/notificationSound";
import { supabase } from "@/lib/supabase";

export default function BoardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [hasJapaneseVoice, setHasJapaneseVoice] = useState(false);
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const previousReadyIdsRef = useRef<Set<string>>(new Set());
  const hasLoadedOrdersRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchActiveOrders();
      if (!hasLoadedOrdersRef.current) {
        previousReadyIdsRef.current = new Set(data.filter((order) => order.status === "ready").map((order) => order.id));
        hasLoadedOrdersRef.current = true;
      }
      setOrders(data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    notificationAudioRef.current = createNotificationAudio();
    return () => {
      notificationAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const speechSynthesis = window.speechSynthesis;
    const updateVoices = () => {
      setHasJapaneseVoice(speechSynthesis.getVoices().some((voice) => voice.lang.toLowerCase().startsWith("ja")));
    };
    updateVoices();
    speechSynthesis.addEventListener("voiceschanged", updateVoices);
    const voicePoll = window.setInterval(updateVoices, 500);
    return () => {
      speechSynthesis.removeEventListener("voiceschanged", updateVoices);
      window.clearInterval(voicePoll);
    };
  }, []);

  useEffect(() => {
    const currentReadyOrders = orders.filter((order) => order.status === "ready");
    const currentReadyIds = new Set(currentReadyOrders.map((order) => order.id));
    const newlyReadyOrders = currentReadyOrders.filter((order) => !previousReadyIdsRef.current.has(order.id));
    previousReadyIdsRef.current = currentReadyIds;

    if (newlyReadyOrders.length === 0) return;
    if (audioEnabled) {
      const audio = notificationAudioRef.current;
      if (audio) playNotificationAudio(audio);
    }

    if (speechEnabled && hasJapaneseVoice && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window) {
      const speechSynthesis = window.speechSynthesis;
      for (const order of newlyReadyOrders) {
        const voice = speechSynthesis.getVoices().find((candidate) => candidate.lang.toLowerCase().startsWith("ja"));
        if (!voice) break;
        const utterance = new SpeechSynthesisUtterance(`${order.number}番のお客様`);
        utterance.lang = voice.lang;
        utterance.voice = voice;
        try {
          speechSynthesis.speak(utterance);
        } catch {
          // Speech synthesis is best effort only.
        }
      }
    }
  }, [audioEnabled, hasJapaneseVoice, orders, speechEnabled]);

  useEffect(() => {
    load();

    const channel = supabase
      .channel("board-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    const poll = setInterval(load, 5000);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(poll);
    };
  }, [load]);

  async function handleHandOver(id: string) {
    setUpdating(id);
    try {
      await updateOrderStatus(id, "handed");
      await load();
    } finally {
      setUpdating(null);
    }
  }

  async function enableAudio() {
    setAudioEnabled(true);
    const audio = notificationAudioRef.current;
    if (audio) await unlockNotificationAudio(audio);
  }

  // 受け取り可能: 完了(呼び出し中)かつ未受け渡し。受け取り待ち: 受付/調理中で、まだ呼ばれていない。
  const readyOrders = orders.filter((o) => o.status === "ready");
  const waitingOrders = orders.filter((o) => o.status === "received" || o.status === "cooking");

  return (
    <main className="festival-bg min-h-screen px-3 py-3">
      <div className="relative z-10 mx-auto flex min-h-[88vh] w-full max-w-md flex-col gap-3 overflow-hidden rounded-[28px] glass-panel p-4">
        <header className="relative z-10 text-center">
          <p className="text-sm font-black tracking-[0.3em] text-ink neon-title">呼び出しボード</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => void enableAudio()}
              className={`rounded-xl border px-3 py-2 text-xs font-bold ${
                audioEnabled ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-brand-vermilion bg-brand-vermilion/10 text-brand-vermilion"
              }`}
            >
              {audioEnabled ? "🔊 音 ON" : "🔇 音を有効にする"}
            </button>
            <button
              onClick={() => setSpeechEnabled((enabled) => !enabled)}
              disabled={!hasJapaneseVoice}
              className={`rounded-xl border px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50 ${
                speechEnabled ? "border-brand-indigo bg-brand-indigo/10 text-brand-indigo" : "border-line bg-white text-sub"
              }`}
            >
              {hasJapaneseVoice ? `読み上げ ${speechEnabled ? "ON" : "OFF"}` : "日本語読み上げなし"}
            </button>
          </div>
          {!audioEnabled && <p className="mt-2 text-xs font-bold text-brand-vermilion">音を有効にするまで通知音は鳴りません</p>}
        </header>

        {readyOrders.length === 0 && waitingOrders.length === 0 && (
          <div className="relative z-10 flex min-h-[70vh] flex-col items-center justify-center rounded-[28px] border border-line bg-canvas text-sub">
            <p className="text-6xl">🎪</p>
            <p className="mt-4 text-xl font-bold">注文が入ると表示されます</p>
          </div>
        )}

        {readyOrders.length > 0 && (
          <section className="relative z-10 rounded-[34px] border-[3px] border-emerald-500 bg-emerald-50 px-4 py-4">
            <p className="text-center text-[25px] font-bold uppercase tracking-[0.3em] text-emerald-700">READY</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {readyOrders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => handleHandOver(order.id)}
                  disabled={updating === order.id}
                  className="flex aspect-[6/5] flex-col items-center justify-center gap-1 rounded-[18px] border-2 border-emerald-400 bg-white px-1 text-center disabled:opacity-50"
                >
                  <p className="text-[42px] font-black leading-none text-ink neon-title">{order.number}</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                    {updating === order.id ? "..." : "タップでお渡し完了"}
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}

        {waitingOrders.length > 0 && (
          <section className="relative z-10 rounded-[26px] border border-line bg-surface px-3 py-2.5">
            <p className="text-center text-sm font-black text-ink neon-title">受け取り待ち</p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {waitingOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex aspect-[8/3] flex-col items-center justify-center rounded-[18px] border-2 border-brand-gold/70 bg-canvas px-1 text-center"
                >
                  <p className="text-[36px] font-black leading-none text-ink neon-title">{order.number}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
