"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

interface Props {
  // trueの間はカメラ映像は表示したままデコードだけ止める(確認画面表示中に同じQRを連続で拾わないため)。
  paused: boolean;
  onScan: (rawValue: string) => void;
}

type CameraState = "starting" | "ready" | "error";

export default function CameraQrScanner({ paused, onScan }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [state, setState] = useState<CameraState>("starting");
  const [errorMessage, setErrorMessage] = useState("");

  // tick()のクロージャ内から常に最新のpaused/onScanを見るため、refで橋渡しする
  // (依存配列にpaused/onScanを入れるとカメラの再起動が起きてしまうため避ける)。
  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let frameId = 0;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setState("ready");

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d", { willReadFrequently: true });

        function tick() {
          if (cancelled) return;
          frameId = requestAnimationFrame(tick);
          if (pausedRef.current) return;
          if (!canvas || !ctx || !video || video.readyState !== video.HAVE_ENOUGH_DATA) return;

          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(frame.data, frame.width, frame.height);
          if (code && code.data) {
            onScanRef.current(code.data);
          }
        }

        frameId = requestAnimationFrame(tick);
      } catch {
        if (!cancelled) {
          setState("error");
          setErrorMessage("カメラを起動できませんでした。ブラウザのカメラ権限を確認してください。");
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-ink">
      <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />

      {state === "starting" && (
        <div className="absolute inset-0 flex items-center justify-center bg-ink/70 text-sm text-white">
          カメラを起動しています...
        </div>
      )}

      {state === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-ink/85 px-4 text-center text-sm text-white">
          {errorMessage}
        </div>
      )}

      {state === "ready" && !paused && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[62%] w-[62%] rounded-2xl border-2 border-white/80" />
        </div>
      )}
    </div>
  );
}
