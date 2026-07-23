import React, { useReducer, useState, useEffect } from "react";
import {
  ShoppingCart, Plus, Minus, Check, X, RotateCcw, Bell,
  ScanLine, ChefHat, Megaphone, Smartphone,
} from "lucide-react";

/* ------------------------------------------------------------------ *
 * 文化祭モバイルオーダー — 番号ループ検証シミュレータ
 * 1つの状態(注文リスト)を、5つの画面が別々の角度から見ているだけ。
 * 本物のSupabase/端末間同期の代わりに、共有stateで全役割を再現する。
 * ------------------------------------------------------------------ */

const C = {
  bg: "#E7EBEE", surface: "#FFFFFF", ink: "#1B2027", sub: "#5B6472",
  line: "#D6DCE2", indigo: "#23406E", vermilion: "#E4572E", gold: "#C88A1A",
};

const STATE = {
  "受付":          { fg: "#3E5C86", bg: "#EAF0F8", label: "受付" },
  "調理中":        { fg: "#9A6A12", bg: "#FBF2DD", label: "調理中" },
  "完了":          { fg: "#C43E1B", bg: "#FBE7DF", label: "呼び出し中" },
  "受け渡し済み":  { fg: "#6B7686", bg: "#EDF0F3", label: "受け渡し済み" },
  "取消":          { fg: "#A24A5E", bg: "#F6E7EB", label: "取消" },
};

const MENU = [
  { name: "たこ焼き", price: 400 },
  { name: "からあげ", price: 350 },
  { name: "やきそば", price: 500 },
  { name: "ドリンク", price: 150 },
];

const FLOW = ["受付", "調理中", "完了", "受け渡し済み"];
const pad = (n) => String(n).padStart(2, "0");
const uid = () => "u" + Math.random().toString(36).slice(2, 8);
const total = (items) => items.reduce((s, i) => s + i.price * i.qty, 0);

/* ---------------------------- reducer ---------------------------- */

function reducer(s, a) {
  switch (a.type) {
    case "PLACE": {
      const next = s.counters[a.prefix] + 1;
      const order = {
        id: uid(), uid: a.uid, prefix: a.prefix, seq: next,
        number: `${a.prefix}-${pad(next)}`, items: a.items,
        status: "受付", prev: null,
      };
      return { ...s, orders: [...s.orders, order],
        counters: { ...s.counters, [a.prefix]: next } };
    }
    case "ADVANCE": {
      let pulse = s.pulse;
      const orders = s.orders.map((o) => {
        if (o.id !== a.id || o.status === "取消") return o;
        const i = FLOW.indexOf(o.status);
        if (i < 0 || i >= FLOW.length - 1) return o;
        const status = FLOW[i + 1];
        if (status === "完了") pulse = o.id;
        return { ...o, status };
      });
      return { ...s, orders, pulse };
    }
    case "BACK":
      return { ...s, orders: s.orders.map((o) => {
        if (o.id !== a.id) return o;
        if (o.status === "取消") return { ...o, status: o.prev || "受付" };
        const i = FLOW.indexOf(o.status);
        return i > 0 ? { ...o, status: FLOW[i - 1] } : o;
      }) };
    case "CANCEL":
      return { ...s, orders: s.orders.map((o) =>
        o.id === a.id ? { ...o, prev: o.status, status: "取消" } : o) };
    case "CLEAR_PULSE":
      return { ...s, pulse: null };
    case "RESET":
      return { orders: [], counters: { A: 0, B: 0 }, pulse: null };
    default:
      return s;
  }
}

/* ------------------------- small UI atoms ------------------------ */

function Pane({ tag, title, icon, accent, children, right }) {
  return (
    <section style={{ background: C.surface, borderColor: C.line }}
      className="rounded-2xl border shadow-sm flex flex-col overflow-hidden">
      <header className="flex items-center gap-2.5 px-4 py-3 border-b"
        style={{ borderColor: C.line }}>
        <span className="grid place-items-center rounded-lg w-8 h-8 shrink-0"
          style={{ background: accent + "1A", color: accent }}>{icon}</span>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-widest font-mono"
            style={{ color: C.sub }}>{tag}</div>
          <div className="text-[15px] font-semibold leading-tight"
            style={{ color: C.ink }}>{title}</div>
        </div>
        <div className="ml-auto">{right}</div>
      </header>
      <div className="p-4 flex-1">{children}</div>
    </section>
  );
}

function Chip({ status, big, pulse }) {
  const st = STATE[status];
  return (
    <span className={"inline-flex items-center gap-1 rounded-md font-mono font-semibold " +
        (big ? "text-2xl px-3 py-1.5 " : "text-xs px-2 py-1 ") +
        (pulse ? "loop-pulse" : "")}
      style={{ color: st.fg, background: st.bg }}>{st.label}</span>
  );
}

function NumberTag({ number, prefix, big, pulse }) {
  const color = prefix === "A" ? C.indigo : C.gold;
  return (
    <span className={"font-mono font-bold tracking-tight " + (big ? "text-4xl" : "text-lg") +
        (pulse ? " loop-pulse" : "")} style={{ color }}>{number}</span>
  );
}

function Btn({ onClick, children, kind = "ghost", disabled }) {
  const styles = {
    solid:  { background: C.indigo, color: "#fff", border: C.indigo },
    call:   { background: C.vermilion, color: "#fff", border: C.vermilion },
    ghost:  { background: "#fff", color: C.ink, border: C.line },
  }[kind];
  return (
    <button onClick={onClick} disabled={disabled}
      className="rounded-lg border px-3 py-1.5 text-sm font-medium transition
        active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ ...styles }}>{children}</button>
  );
}

function ItemLines({ items, mono }) {
  return (
    <ul className="space-y-0.5">
      {items.map((i, k) => (
        <li key={k} className="flex justify-between text-sm" style={{ color: C.sub }}>
          <span>{i.name} <span className="opacity-60">×{i.qty}</span></span>
          <span className={mono ? "font-mono" : ""}>¥{i.price * i.qty}</span>
        </li>
      ))}
    </ul>
  );
}

function FauxQR({ seed }) {
  let h = 2166136261;
  for (const ch of seed) h = (h ^ ch.charCodeAt(0)) * 16777619 >>> 0;
  const n = 11, cells = [];
  for (let i = 0; i < n * n; i++) { h = (h * 1103515245 + 12345) & 0x7fffffff; cells.push(h % 100 < 46); }
  return (
    <div className="grid gap-px rounded-md p-2" style={{ background: "#fff",
      gridTemplateColumns: `repeat(${n}, 1fr)`, width: 132, height: 132 }}>
      {cells.map((on, i) => (
        <div key={i} style={{ background: on ? C.ink : "#fff", borderRadius: 1 }} />
      ))}
    </div>
  );
}

/* ----------------------------- app ------------------------------ */

export default function App() {
  const [s, dispatch] = useReducer(reducer, { orders: [], counters: { A: 0, B: 0 }, pulse: null });
  const [toast, setToast] = useState(null);

  // 来場者スマホ
  const [cart, setCart] = useState([]);
  const [custUid, setCustUid] = useState(null);
  const [showQr, setShowQr] = useState(false);
  // A端末プレビュー / B端末カート
  const [aPreview, setAPreview] = useState(null);
  const [bCart, setBCart] = useState([]);

  useEffect(() => {
    if (s.pulse) { const t = setTimeout(() => dispatch({ type: "CLEAR_PULSE" }), 1400); return () => clearTimeout(t); }
  }, [s.pulse]);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 2400); return () => clearTimeout(t); }
  }, [toast]);

  const myOrder = custUid ? s.orders.find((o) => o.uid === custUid) : null;

  const addTo = (setter, item) => setter((prev) => {
    const f = prev.find((i) => i.name === item.name);
    return f ? prev.map((i) => i.name === item.name ? { ...i, qty: i.qty + 1 } : i)
             : [...prev, { ...item, qty: 1 }];
  });
  const dec = (setter, name) => setter((prev) =>
    prev.map((i) => i.name === name ? { ...i, qty: i.qty - 1 } : i).filter((i) => i.qty > 0));

  const showMyQr = () => { if (!cart.length) return; if (!custUid) setCustUid(uid()); setShowQr(true); };

  const scan = () => {
    if (!custUid || !showQr || !cart.length) { setToast("客側で「注文QRを表示」を押してください"); return; }
    setAPreview({ uid: custUid, items: cart });
  };
  const payA = () => {
    const existing = s.orders.find((o) => o.uid === aPreview.uid);
    if (existing) { setToast(`この注文は受付済み（${existing.number}）— 二重発行しません`); setAPreview(null); return; }
    dispatch({ type: "PLACE", prefix: "A", uid: aPreview.uid, items: aPreview.items });
    setAPreview(null); setShowQr(false);
  };
  const checkoutB = () => {
    if (!bCart.length) return;
    dispatch({ type: "PLACE", prefix: "B", uid: uid(), items: bCart });
    setBCart([]);
  };
  const resetCustomer = () => { setCart([]); setCustUid(null); setShowQr(false); };

  const kitchen = s.orders.filter((o) => o.status === "受付" || o.status === "調理中");
  const calling = s.orders.filter((o) => o.status === "完了");

  return (
    <div style={{ background: C.bg, color: C.ink, minHeight: "100%" }}
      className="p-4 sm:p-6 font-sans">
      <style>{`
        .loop-pulse { animation: loopPulse 1.4s ease-out; }
        @keyframes loopPulse {
          0% { box-shadow: 0 0 0 0 rgba(228,87,46,.55); }
          70% { box-shadow: 0 0 0 12px rgba(228,87,46,0); }
          100% { box-shadow: 0 0 0 0 rgba(228,87,46,0); }
        }
        @media (prefers-reduced-motion: reduce) { .loop-pulse { animation: none; } }
      `}</style>

      {/* header */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2 mb-5">
        <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
          番号ループ検証台
        </h1>
        <p className="text-sm" style={{ color: C.sub }}>
          1つの注文リストを、5つの画面が見ている。完了を押すと3経路が同時に動く。
        </p>
        <button onClick={() => { dispatch({ type: "RESET" }); resetCustomer(); setBCart([]); setAPreview(null); }}
          className="ml-auto rounded-lg border px-3 py-1.5 text-sm inline-flex items-center gap-1.5"
          style={{ borderColor: C.line, background: "#fff", color: C.sub }}>
          <RotateCcw size={14} /> 全部リセット
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        {/* ---- 来場者スマホ ---- */}
        <Pane tag="phone" title="来場者スマホ" accent={C.indigo} icon={<Smartphone size={17} />}>
          <div className="mx-auto max-w-[280px] rounded-2xl border p-4"
            style={{ borderColor: C.line, background: "#FAFBFC" }}>
            {myOrder ? (
              <div className="text-center py-3">
                <div className="text-xs mb-1" style={{ color: C.sub }}>あなたの番号</div>
                <NumberTag number={myOrder.number} prefix={myOrder.prefix} big
                  pulse={s.pulse === myOrder.id} />
                <div className="mt-3"><Chip status={myOrder.status} pulse={s.pulse === myOrder.id} /></div>
                {myOrder.status === "完了" && (
                  <div className="mt-3 text-sm font-semibold flex items-center justify-center gap-1.5"
                    style={{ color: C.vermilion }}>
                    <Bell size={15} /> できあがりました
                    {myOrder.prefix === "A" &&
                      <span className="text-[10px] font-normal rounded px-1.5 py-0.5"
                        style={{ background: "#FBE7DF", color: C.vermilion }}>通知送信</span>}
                  </div>
                )}
                {myOrder.status === "受け渡し済み" && (
                  <div className="mt-4">
                    <div className="text-sm mb-2" style={{ color: C.sub }}>お受け取りありがとうございました</div>
                    <Btn onClick={resetCustomer}>次の注文へ</Btn>
                  </div>
                )}
                {myOrder.status !== "受け渡し済み" && (
                  <div className="mt-4 text-xs" style={{ color: C.sub }}>受け取り時にお知らせします</div>
                )}
              </div>
            ) : showQr ? (
              <div className="text-center">
                <div className="text-xs mb-2" style={{ color: C.sub }}>この画面をレジで見せてください</div>
                <div className="flex justify-center"><FauxQR seed={custUid + cart.map(i=>i.name+i.qty).join("")} /></div>
                <div className="mt-2 font-mono text-[10px]" style={{ color: C.sub }}>固有ID {custUid}</div>
                <div className="mt-3 text-left"><ItemLines items={cart} mono /></div>
                <div className="text-xs mt-2 animate-pulse" style={{ color: C.indigo }}>スキャン待ち…</div>
                <button onClick={() => setShowQr(false)} className="mt-2 text-xs underline" style={{ color: C.sub }}>戻る</button>
              </div>
            ) : (
              <div>
                <div className="space-y-1.5 mb-3">
                  {MENU.map((m) => (
                    <div key={m.name} className="flex items-center justify-between rounded-lg border px-2.5 py-1.5"
                      style={{ borderColor: C.line, background: "#fff" }}>
                      <span className="text-sm">{m.name}</span>
                      <span className="font-mono text-xs mr-auto ml-2" style={{ color: C.sub }}>¥{m.price}</span>
                      <button onClick={() => addTo(setCart, m)}
                        className="grid place-items-center rounded-md w-6 h-6"
                        style={{ background: C.indigo, color: "#fff" }}><Plus size={14} /></button>
                    </div>
                  ))}
                </div>
                {cart.length > 0 && (
                  <div className="rounded-lg border p-2.5 mb-3" style={{ borderColor: C.line, background: "#fff" }}>
                    {cart.map((i) => (
                      <div key={i.name} className="flex items-center justify-between text-sm py-0.5">
                        <span>{i.name}</span>
                        <span className="flex items-center gap-1.5">
                          <button onClick={() => dec(setCart, i.name)}><Minus size={13} /></button>
                          <span className="font-mono w-4 text-center">{i.qty}</span>
                          <button onClick={() => addTo(setCart, i)}><Plus size={13} /></button>
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-semibold mt-1.5 pt-1.5 border-t"
                      style={{ borderColor: C.line }}>
                      <span>合計</span><span className="font-mono">¥{total(cart)}</span>
                    </div>
                  </div>
                )}
                <Btn kind="solid" onClick={showMyQr} disabled={!cart.length}>
                  <span className="inline-flex items-center gap-1.5"><ShoppingCart size={15} /> 注文QRを表示</span>
                </Btn>
              </div>
            )}
          </div>
        </Pane>

        {/* ---- 中列: A端末 / B端末 ---- */}
        <div className="space-y-4">
          <Pane tag="pos · A" title="A端末（読み取り）" accent={C.indigo} icon={<ScanLine size={17} />}
            right={<span className="font-mono text-xs" style={{ color: C.sub }}>次 A-{pad(s.counters.A + 1)}</span>}>
            {aPreview ? (
              <div>
                <div className="text-xs mb-1" style={{ color: C.sub }}>読み取り内容（プレビュー）</div>
                <div className="rounded-lg border p-2.5 mb-3" style={{ borderColor: C.line }}>
                  <ItemLines items={aPreview.items} mono />
                  <div className="flex justify-between text-sm font-semibold mt-1.5 pt-1.5 border-t"
                    style={{ borderColor: C.line }}><span>合計</span><span className="font-mono">¥{total(aPreview.items)}</span></div>
                </div>
                <div className="flex gap-2">
                  <Btn kind="solid" onClick={payA}><span className="inline-flex items-center gap-1.5"><Check size={15} /> 支払い完了・番号発行</span></Btn>
                  <Btn onClick={() => setAPreview(null)}>やり直し</Btn>
                </div>
              </div>
            ) : (
              <div className="text-center py-2">
                <p className="text-sm mb-3" style={{ color: C.sub }}>スキャンは内容の確認だけ。番号は支払い時に発行する。</p>
                <Btn onClick={scan}><span className="inline-flex items-center gap-1.5"><ScanLine size={15} /> 客のQRを読み取る</span></Btn>
              </div>
            )}
          </Pane>

          <Pane tag="pos · B" title="B端末（店頭）" accent={C.gold} icon={<ShoppingCart size={17} />}
            right={<span className="font-mono text-xs" style={{ color: C.sub }}>次 B-{pad(s.counters.B + 1)}</span>}>
            <div className="grid grid-cols-2 gap-1.5 mb-3">
              {MENU.map((m) => (
                <button key={m.name} onClick={() => addTo(setBCart, m)}
                  className="rounded-lg border px-2 py-1.5 text-sm text-left"
                  style={{ borderColor: C.line, background: "#fff" }}>
                  {m.name}<span className="font-mono text-xs block" style={{ color: C.sub }}>¥{m.price}</span>
                </button>
              ))}
            </div>
            {bCart.length > 0 && (
              <div className="rounded-lg border p-2.5 mb-3" style={{ borderColor: C.line }}>
                <ItemLines items={bCart} mono />
                <div className="flex justify-between text-sm font-semibold mt-1.5 pt-1.5 border-t" style={{ borderColor: C.line }}>
                  <span>合計</span><span className="font-mono">¥{total(bCart)}</span>
                </div>
              </div>
            )}
            <Btn kind="solid" onClick={checkoutB} disabled={!bCart.length}>
              <span className="inline-flex items-center gap-1.5"><Check size={15} /> 会計・番号発行（紙の番号札）</span>
            </Btn>
          </Pane>
        </div>

        {/* ---- 右列: 調理 / ボード ---- */}
        <div className="space-y-4">
          <Pane tag="kitchen" title="調理ディスプレイ" accent={C.gold} icon={<ChefHat size={17} />}>
            {kitchen.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: C.sub }}>作る注文はまだありません。</p>
            ) : (
              <ul className="space-y-2">
                {kitchen.map((o) => (
                  <li key={o.id} className="rounded-lg border p-2.5" style={{ borderColor: C.line }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <NumberTag number={o.number} prefix={o.prefix} />
                      <Chip status={o.status} />
                      <div className="ml-auto flex gap-1">
                        {o.status === "調理中" &&
                          <button onClick={() => dispatch({ type: "BACK", id: o.id })} title="戻す"
                            className="grid place-items-center w-7 h-7 rounded-md border" style={{ borderColor: C.line, color: C.sub }}><RotateCcw size={13} /></button>}
                        <button onClick={() => dispatch({ type: "CANCEL", id: o.id })} title="取消"
                          className="grid place-items-center w-7 h-7 rounded-md border" style={{ borderColor: C.line, color: STATE["取消"].fg }}><X size={13} /></button>
                      </div>
                    </div>
                    <ItemLines items={o.items} />
                    <div className="mt-2">
                      <Btn kind={o.status === "調理中" ? "call" : "solid"} onClick={() => dispatch({ type: "ADVANCE", id: o.id })}>
                        {o.status === "受付" ? "調理を始める" : "できあがり"}
                      </Btn>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Pane>

          <Pane tag="board" title="呼び出しボード" accent={C.vermilion} icon={<Megaphone size={17} />}>
            {calling.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: C.sub }}>呼び出し中の番号はありません。</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {calling.map((o) => (
                  <div key={o.id} className="rounded-xl border p-3 text-center"
                    style={{ borderColor: STATE["完了"].bg, background: STATE["完了"].bg }}>
                    <NumberTag number={o.number} prefix={o.prefix} big pulse={s.pulse === o.id} />
                    <div className="mt-2">
                      <Btn onClick={() => dispatch({ type: "ADVANCE", id: o.id })}>お渡し完了</Btn>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Pane>
        </div>
      </div>

      {toast && (
        <div className="fixed left-1/2 bottom-6 -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm shadow-lg"
          style={{ background: C.ink, color: "#fff" }}>{toast}</div>
      )}
    </div>
  );
}
