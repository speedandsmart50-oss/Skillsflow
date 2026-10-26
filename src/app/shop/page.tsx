import { CatalogSearch } from "@/components/catalog-search";
import { connection } from "next/server";
import { Suspense } from "react";
import { getCatalogProducts, getUpcomingCatalogSkills } from "@/features/products/catalog";
import { SalesActivityPop } from "@/components/sales-activity-pop";

export default function ShopPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#0d1321]" aria-busy="true" />}>
      <ShopContent />
    </Suspense>
  );
}

async function ShopContent() {
  await connection();
  const [products, upcomingSkills] = await Promise.all([getCatalogProducts(), getUpcomingCatalogSkills()]);

  return (
    <main className="relative overflow-hidden bg-[#0d1321] px-4 py-12 text-white sm:px-6 lg:px-8 lg:py-16">
      <div className="pointer-events-none absolute left-1/2 top-[-260px] h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-cyan-400/10 blur-[120px]" />
      <div className="relative mx-auto max-w-[1200px]">
        <div className="flex flex-col gap-6 border-b border-slate-800 pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Catalogue SkillFlow</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">Des skills et des packs pour votre activit&#233;.</h1>
            <p className="mt-4 max-w-2xl text-lg text-slate-300">Choisissez un skill &#224; l&#8217;unit&#233; ou un pack qui regroupe plusieurs comp&#233;tences compl&#233;mentaires.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-cyan-400/20 bg-slate-900/70 px-4 py-2 text-sm text-slate-300">
            <span className="h-2 w-2 rounded-full bg-cyan-300" />
            {products.filter((product) => !product.includedSkills?.length).length} skills &#183; {products.filter((product) => product.includedSkills?.length).length} {products.filter((product) => product.includedSkills?.length).length === 1 ? "pack" : "packs"}
          </div>
        </div>

        <CatalogSearch products={products} />

        {upcomingSkills.length > 0 && (
          <section className="mt-16 border-t border-slate-800 pt-10" aria-labelledby="upcoming-skills-title">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">La bibliothèque s’agrandit</p>
                <h2 id="upcoming-skills-title" className="mt-2 text-2xl font-bold text-white sm:text-3xl">D’autres skills arrivent au catalogue.</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-300">Découvrez les compétences en préparation. Elles seront achetables depuis cette page dès leur publication.</p>
              </div>
              <span className="text-sm text-slate-400">{upcomingSkills.length} en préparation</span>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {upcomingSkills.map((skill) => {
                const category = Array.isArray(skill.skill_categories) ? skill.skill_categories[0] : skill.skill_categories;
                return (
                  <article key={skill.id} className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-5 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/30">
                    <span className="rounded-full border border-slate-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300">En préparation</span>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-cyan-200">{category?.name ?? "Skill IA"}</p>
                    <h3 className="mt-2 text-lg font-semibold text-white">{skill.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{skill.short_description}</p>
                    <div className="mt-5 border-t border-slate-700 pt-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Prix prévu</p>
                      <p className="mt-1 font-bold text-white">€{(skill.price_cents / 100).toFixed(2)}</p>
                      <p className="text-xs text-cyan-200">{new Intl.NumberFormat("fr-FR").format(Math.round((skill.price_cents / 100) * 655.957))} XOF</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <div className="mt-12 rounded-2xl border border-cyan-400/15 bg-gradient-to-r from-slate-900 to-slate-800/70 px-6 py-8 text-center sm:px-10">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Après votre achat</p>
          <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">Retrouvez votre pack dans votre compte.</h2>
          <p className="mt-3 text-sm text-slate-300">Le téléchargement sécurisé s’active après confirmation du paiement.</p>
        </div>
      </div>
      <SalesActivityPop />
    </main>
  );
}
