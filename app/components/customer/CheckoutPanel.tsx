"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { serializeQrPayload } from "@/lib/qr";
import { CartItem, QrOrderPayload } from "@/types";

interface Props {
  cart: CartItem[];
  total: number;
  orderId: string;
  timedOut: boolean;
  onBack: () => void;
}

export default function CheckoutPanel({ cart, total, orderId, timedOut, onBack }: Props) {
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  const qrPayload = useMemo<QrOrderPayload>(
    () => ({
      version: 1,
      orderId,
      items: cart.map((item) => ({
        menuId: item.menuItem.id,
        qty: item.qty,
        yakitoriSelections: item.yakitoriSelections?.map((s) => ({
          flavorId: s.flavorId,
          typeId: s.typeId,
        })),
        optionIds: item.options?.map((option) => option.id),
      })),
    }),
    [cart, orderId]
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
      <div className="rounded-2xl border border-line bg-canvas p-4 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-sub">Checkout QR</p>
        <h2 className="mt-2 text-xl font-black text-ink">レジで読み取ってください</h2>
        <p className="mt-2 text-sm text-sub">これはまだ注文ではありません。会計時にレジで番号が発行されます。</p>
      </div>

      <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-2xl border border-line bg-surface p-4">
        {timedOut ? (
          <div className="rounded-2xl border border-brand-gold/40 bg-brand-gold/10 px-5 py-6 text-center text-lg font-black text-brand-gold">
            レジで番号を確認してください
          </div>
        ) : qrCodeUrl ? (
          <Image
            src={qrCodeUrl}
            alt="会計用QRコード"
            width={320}
            height={320}
            unoptimized
            className="w-full max-w-[320px] rounded-lg bg-white p-3"
          />
        ) : (
          <div className="flex h-[320px] w-full max-w-[320px] items-center justify-center rounded-lg bg-canvas text-sm text-sub">
            QRコードを生成中...
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-canvas p-4">
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-sub">注文内容</p>
        <div className="space-y-2">
          {cart.map((item) => (
            <div key={item.lineId ?? item.menuItem.id} className="flex items-start justify-between text-sm text-ink">
              <span>
                {item.menuItem.name} x {item.qty}
                {item.yakitoriSelections && (
                  <span className="block text-xs text-sub">
                    {item.yakitoriSelections.map((s, i) => `${i + 1}.${s.typeName}×${s.flavorName}`).join("、")}
                  </span>
                )}
              </span>
              <span>¥{(item.menuItem.price * item.qty).toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <span className="text-sm font-bold text-sub">TOTAL</span>
          <span className="text-xl font-black text-ink">¥{total.toLocaleString()}</span>
        </div>
      </div>

      <button
        onClick={onBack}
        className="mt-4 rounded-2xl border border-line px-4 py-4 text-sm font-bold text-sub"
      >
        カートに戻る
      </button>
    </div>
  );
}
