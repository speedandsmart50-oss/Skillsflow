import Link from "next/link";
import type { Product } from "@/types/skillflow";

export function ProductCard({ product }: { product: Product }) {
  const isTopSeller = product.slug === "go-pro-mlm";
  const catalogStatusLabels = {
    a_venir: "À venir",
    en_preparation: "En préparation",
    disponible: "Disponible",
  } as const;

  return (
    <article className="flex h-full flex-col rounded-3xl border border-cyan-400/15 bg-slate-900/60 p-6 shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition hover:-translate-y-1 hover:border-cyan-400/35">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex flex-col items-start gap-2">
          {Boolean(product.includedSkills?.length) && <span className="rounded-full border border-violet-300/30 bg-violet-300/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-violet-200">Pack - {product.includedSkills?.length} skills</span>}
          {isTopSeller && <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-cyan-200"><span aria-hidden="true">★</span> Parmi les plus achetés</span>}
          <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-300">{catalogStatusLabels[product.catalogStatus]}</span>
        </div>
        <span className="text-right text-lg font-black text-white">
          €{product.price.toFixed(2)}
          <span className="block text-xs font-medium text-cyan-200">
            {new Intl.NumberFormat("fr-FR").format(product.priceXof)} XOF
          </span>
        </span>
      </div>
      <h3 className="mt-5 text-xl font-semibold text-white">{product.name}</h3>
      {Boolean(product.includedSkills?.length) && <p className="mt-2 min-h-12 text-sm leading-6 text-slate-300">{product.includedSkills?.join(" / ")}</p>}
      <div className="mt-auto flex justify-end border-t border-slate-800 pt-5">
        <Link href={`/products/${product.slug}`} className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-200">Continuer</Link>
      </div>
    </article>
  );
}
