import Link from "next/link";
import type { Product } from "@/types/skillflow";

export function ProductCard({ product }: { product: Product }) {
  const catalogStatusLabels = {
    a_venir: "À venir",
    en_preparation: "En préparation",
    disponible: "Disponible",
  } as const;

  return (
    <article className="rounded-xl border border-cyan-400/15 bg-slate-900/60 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition hover:-translate-y-1 hover:border-cyan-400/35">
      <div className="mb-5 flex items-center justify-between gap-4">
        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-300">{catalogStatusLabels[product.catalogStatus]}</span>
        <span className="text-right text-lg font-black text-white">
          €{product.price.toFixed(2)}
          <span className="block text-xs font-medium text-cyan-200">
            {new Intl.NumberFormat("fr-FR").format(product.priceXof)} XOF
          </span>
        </span>
      </div>
      <h3 className="mt-5 text-xl font-semibold text-white">{product.name}</h3>
      <div className="mt-6 flex items-center justify-between border-t border-slate-800 pt-4">
        <span className="text-sm text-slate-300">Connectable à Claude</span>
        <Link href={`/products/${product.slug}`} className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-200">Continuer</Link>
      </div>
    </article>
  );
}
