"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/types/skillflow";

export function CatalogSearch({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fr");
    if (!normalizedQuery) return products;
    return products.filter((product) => [
      product.name,
      product.domain,
      product.tagline,
      product.description,
      ...product.stack,
    ].some((value) => value.toLocaleLowerCase("fr").includes(normalizedQuery)));
  }, [products, query]);

  return (
    <section className="mt-8" aria-label="Recherche dans le catalogue">
      <label htmlFor="catalog-search" className="sr-only">Rechercher un skill ou un pack</label>
      <div className="relative max-w-xl">
        <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
        <input
          id="catalog-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un skill, un pack ou un domaine"
          autoComplete="off"
          className="w-full rounded-full border border-slate-700 bg-slate-900/80 py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
        />
      </div>
      <p className="mt-3 text-xs text-slate-400" aria-live="polite">
        {filteredProducts.length} {filteredProducts.length === 1 ? "offre trouv\u00e9e" : "offres trouv\u00e9es"}
        {query.trim() ? ` pour « ${query.trim()} »` : " dans le catalogue"}
      </p>
      {filteredProducts.length ? (
        <div className="mt-4 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-900/50 px-6 py-10 text-center">
          <p className="font-semibold text-white">Aucune offre ne correspond &#224; cette recherche.</p>
          <p className="mt-2 text-sm text-slate-400">Essayez un autre nom, m&#233;tier ou domaine.</p>
        </div>
      )}
    </section>
  );
}
