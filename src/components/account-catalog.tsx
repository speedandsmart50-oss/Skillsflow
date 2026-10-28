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
    void fetch("/api/products", { cache: "no-store" })
      .then(async (response) => {
        const payload: unknown = await response.json();
        if (
          !response.ok ||
          typeof payload !== "object" ||
          payload === null ||
          !Array.isArray((payload as { items?: unknown }).items)
        ) {
          throw new Error("Le catalogue est temporairement indisponible.");
        }
        if (active) setItems((payload as { items: Product[] }).items);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Impossible de charger le catalogue.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-[#202E50] bg-[#151F38] p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#397BFF]">Skills disponibles</p>
        <h2 className="mt-2 text-3xl font-black text-white">Le catalogue Skillsflow</h2>
        <p className="mt-2 text-sm text-[#8F9CAE]">
          Retrouvez ici les skills certifiés et prêts à être connectés à votre compte via MCP.
        </p>
      </header>

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center text-sm text-[#8F9CAE]">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#397BFF] border-t-transparent" />
            <span>Chargement du catalogue…</span>
          </div>
        </div>
      ) : error ? (
        <p role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </p>
      ) : items.length ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <ProductCard key={item.id} product={item} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-[#202E50] bg-[#151F38] p-8 text-center text-sm text-[#8F9CAE]">
          Aucun skill publié pour le moment. Revenez bientôt.
        </div>
      )}
    </div>
  );
}
