import Link from "next/link";
import type { Product } from "@/types/skillflow";

export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="rounded-xl border border-cyan-400/15 bg-slate-900/60 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition hover:-translate-y-1 hover:border-cyan-400/35">
      <div className="mb-5 flex items-center justify-between gap-4">
        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-300">Disponible</span>
        <span className="text-right text-lg font-black text-white">
          €{product.price.toFixed(2)}
          <span className="block text-xs font-medium text-cyan-200">
            {new Intl.NumberFormat("fr-FR").format(product.priceXof)} XOF
          </span>
        </span>
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">✦</div>
      <h3 className="mt-5 text-xl font-semibold text-white">{product.name}</h3>
      <p className="mt-2 min-h-12 text-sm leading-6 text-slate-300">{product.tagline}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {product.stack.map((tool) => <span key={tool} className="rounded-full border border-slate-700 bg-slate-950/60 px-2.5 py-1 text-[11px] text-slate-300">{tool}</span>)}
      </div>
      <div className="mt-6 flex items-center justify-between border-t border-slate-800 pt-4">
        <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">v{product.version}</span>
        <Link href={`/products/${product.slug}`} className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-200">Voir le skill</Link>
      </div>
    </article>
  );
}
