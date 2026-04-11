"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { serializeQrPayload } from "@/lib/qr";
import { CartItem, QrOrderPayload } from "@/types";

interface Props {
  cart: CartItem[];
  total: number;
  checkoutToken: string;
  onBack: () => void;
}

export default function CheckoutPanel({ cart, total, checkoutToken, onBack }: Props) {
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  const qrPayload = useMemo<QrOrderPayload>(
    () => ({
      version: 1,
      checkoutToken,
      items: cart.map((item) => ({
        menuId: item.menuItem.id,
        qty: item.qty,
      })),
    }),
    [cart, checkoutToken]
  );

  useEffect(() => {
    let cancelled = false;
    const qrText = serializeQrPayload(qrPayload);

    QRCode.toDataURL(qrText, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
    })
      .then((url: string) => {
        if (!cancelled) {
          setQrCodeUrl(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrCodeUrl("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [qrPayload]);

  return (
    <div className="flex h-full flex-col px-4 py-4">
      <div className="rounded-2xl border border-cyan-300/30 bg-slate-900/65 p-4 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-cyan-200/80">Checkout QR</p>
        <h2 className="mt-2 text-xl font-black text-white">レジで読み取ってください</h2>
        <p className="mt-2 text-sm text-slate-300">会計完了後、自動でお客様情報へ切り替わります。</p>
      </div>

      <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-2xl border border-fuchsia-300/30 bg-slate-900/60 p-4">
        {qrCodeUrl ? (
          <Image
            src={qrCodeUrl}
            alt="会計用QRコード"
            width={320}
            height={320}
            unoptimized
            className="w-full max-w-[320px] rounded-lg bg-white p-3"
          />
        ) : (
          <div className="flex h-[320px] w-full max-w-[320px] items-center justify-center rounded-lg bg-slate-950/70 text-sm text-slate-400">
            QRコードを生成中...
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-cyan-300/25 bg-slate-950/60 p-4">
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-cyan-200/80">注文内容</p>
        <div className="space-y-2">
          {cart.map((item) => (
            <div key={item.menuItem.id} className="flex items-center justify-between text-sm text-slate-100">
              <span>
                {item.menuItem.name} x {item.qty}
              </span>
              <span>¥{(item.menuItem.price * item.qty).toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-slate-700 pt-3">
          <span className="text-sm font-bold text-fuchsia-200">TOTAL</span>
          <span className="text-xl font-black text-white">¥{total.toLocaleString()}</span>
        </div>
      </div>

      <button
        onClick={onBack}
        className="mt-4 rounded-2xl border border-slate-300/40 px-4 py-4 text-sm font-bold text-slate-200"
      >
        カートに戻る
      </button>
    </div>
  );
}
