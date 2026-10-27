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
    <article className="catalog-product-card group flex h-full flex-col rounded-3xl border border-[#202E50] bg-[#151F38] p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-[#397BFF]/50 hover:shadow-[0_12px_36px_rgba(57,123,255,0.2)]">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex flex-col items-start gap-2">
          {Boolean(product.includedSkills?.length) && (
            <span className="rounded-full border border-[#B3A4FF]/30 bg-[#6557FF]/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#B3A4FF]">
              Pack • {product.includedSkills?.length} skills
            </span>
          )}
          {isTopSeller && (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#397BFF]/30 bg-[#397BFF]/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#8FB5FF]">
              <span aria-hidden="true">★</span> Top vente
            </span>
          )}
          <span className="rounded-full border border-[#00E5FF]/20 bg-[#00E5FF]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#00E5FF]">
            {catalogStatusLabels[product.catalogStatus]}
          </span>
        </div>

        <span className="catalog-product-price text-right text-lg font-black text-white">
          €{product.price.toFixed(2)}
          <span className="block text-xs font-medium text-[#8F9CAE]">
            {new Intl.NumberFormat("fr-FR").format(product.priceXof)} XOF
          </span>
        </span>
      </div>

      <h3 className="mt-3 text-xl font-bold text-white group-hover:text-[#8FB5FF] transition">
        {product.name}
      </h3>

      {Boolean(product.includedSkills?.length) && (
        <p className="mt-2 min-h-12 text-sm leading-6 text-[#8F9CAE]">
          {product.includedSkills?.join(" • ")}
        </p>
      )}

      <div className="mt-auto flex justify-end border-t border-[#202E50] pt-5">
        <Link
          href={`/products/${product.slug}`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#397BFF] to-[#6557FF] px-5 py-2.5 text-xs font-bold text-white shadow-md transition hover:brightness-110 active:scale-95"
        >
          <span>Continuer</span>
          <span>→</span>
        </Link>
      </div>
    </article>
  );
}
