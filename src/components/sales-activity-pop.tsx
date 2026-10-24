"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Sale = { id: string; productName: string; productSlug: string; paidAt: string };

function formatElapsed(paidAt: string) {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(paidAt).getTime()) / 60_000));
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}

export function SalesActivityPop() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/sales-activity")
      .then((response) => response.ok ? response.json() : { sales: [] })
      .then((payload: { sales?: Sale[] }) => {
        if (!cancelled && Array.isArray(payload.sales)) setSales(payload.sales);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!sales.length) return;
    const firstPop = window.setTimeout(() => setVisible(true), 1800);
    const rotate = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((current) => (current + 1) % sales.length);
        setVisible(true);
      }, 350);
    }, 14000);
    const dismiss = window.setInterval(() => setVisible(false), 10500);
    return () => {
      window.clearTimeout(firstPop);
      window.clearInterval(rotate);
      window.clearInterval(dismiss);
    };
  }, [sales]);

  if (!sales.length) return null;
  const sale = sales[index % sales.length];

  return (
    <aside
      aria-live="polite"
      aria-atomic="true"
      className={`fixed bottom-5 left-5 z-50 w-[min(23rem,calc(100vw-2.5rem))] transition duration-300 ease-out ${visible ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-5 scale-95 opacity-0"}`}
    >
      <div className="flex items-start gap-3 rounded-2xl border border-cyan-300/25 bg-slate-950/95 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-300/10 text-lg text-emerald-300" aria-hidden="true">✓</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">Achat récent confirmé</p>
          <Link href={`/products/${encodeURIComponent(sale.productSlug)}`} className="mt-1 block truncate text-sm text-cyan-200 hover:text-cyan-100">{sale.productName}</Link>
          <p className="mt-1 text-xs text-slate-400">Par un client · {formatElapsed(sale.paidAt)}</p>
        </div>
        <button type="button" aria-label="Masquer la notification" onClick={() => setVisible(false)} className="rounded p-1 text-slate-400 hover:text-white">×</button>
      </div>
    </aside>
  );
}
