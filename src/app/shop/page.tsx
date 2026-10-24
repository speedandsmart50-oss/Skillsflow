import { ProductCard } from "@/components/product-card";
import { connection } from "next/server";
import { Suspense } from "react";
import { getCatalogProducts } from "@/features/products/catalog";

export default function ShopPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#0d1321]" aria-busy="true" />}>
      <ShopContent />
    </Suspense>
  );
}

async function ShopContent() {
  await connection();
  const products = await getCatalogProducts();

  return (
    <main className="relative overflow-hidden bg-[#0d1321] px-4 py-12 text-white sm:px-6 lg:px-8 lg:py-16">
      <div className="pointer-events-none absolute left-1/2 top-[-260px] h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-cyan-400/10 blur-[120px]" />
      <div className="relative mx-auto max-w-[1200px]">
        <div className="flex flex-col gap-6 border-b border-slate-800 pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Catalogue SkillFlow</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">Une compétence IA, à votre façon de travailler.</h1>
            <p className="mt-4 max-w-2xl text-lg text-slate-300">Des compétences conçues pour vous aider dans votre activité, avec des formats adaptés à vos assistants IA préférés.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-cyan-400/20 bg-slate-900/70 px-4 py-2 text-sm text-slate-300">
            <span className="h-2 w-2 rounded-full bg-cyan-300" />
            {products.length} {products.length === 1 ? "skill au catalogue" : "skills au catalogue"}
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-cyan-400/15 bg-gradient-to-r from-slate-900 to-slate-800/70 px-6 py-8 text-center sm:px-10">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Après votre achat</p>
          <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">Retrouvez votre pack dans votre compte.</h2>
          <p className="mt-3 text-sm text-slate-300">Le téléchargement sécurisé s’active après confirmation du paiement.</p>
        </div>
      </div>
    </main>
  );
}
