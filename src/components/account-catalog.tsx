"use client";

import { useEffect, useState } from "react";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/types/skillflow";

export function AccountCatalog() {
  const [items, setItems] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void fetch("/api/products", { cache: "no-store" }).then(async (response) => {
      const payload: unknown = await response.json();
      if (!response.ok || typeof payload !== "object" || payload === null || !Array.isArray((payload as { items?: unknown }).items)) {
        throw new Error("Le catalogue est temporairement indisponible.");
      }
      if (active) setItems((payload as { items: Product[] }).items);
    }).catch((caught: unknown) => {
      if (active) setError(caught instanceof Error ? caught.message : "Impossible de charger le catalogue.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return <div className="space-y-5">
    <header>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Skills disponibles</p>
      <h2 className="mt-2 font-[family-name:var(--font-bricolage)] text-2xl font-semibold text-white">Le catalogue SkillFlow</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">Retrouvez ici les skills publiés et ouvrez leur fiche pour les acheter et les ajouter à votre espace.</p>
    </header>
    {loading ? <p role="status" className="text-sm text-slate-400">Chargement du catalogue…</p> : error ? <p role="alert" className="rounded-2xl border border-rose-300/25 bg-rose-300/10 p-4 text-sm text-rose-100">{error}</p> : items.length ? <div className="grid gap-4 xl:grid-cols-2">{items.map((item) => <ProductCard key={item.id} product={item} />)}</div> : <p className="account-card rounded-2xl p-5 text-sm text-slate-300">Aucun skill publié pour le moment. Revenez bientôt.</p>}
  </div>;
}
