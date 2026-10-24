import Link from "next/link";

export default function CheckoutPage() {
  return (
    <main className="bg-[#0d1321] px-4 py-12 text-white sm:px-6 lg:px-8 lg:py-16">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Bientôt disponible</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">La boutique ouvre bientôt</h1>
          </div>
          <div className="hidden items-center gap-2 text-sm text-slate-400 sm:flex"><span className="text-cyan-300">●</span> Paiements désactivés</div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
          <section className="rounded-2xl border border-cyan-400/15 bg-slate-900/60 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-8">
            <h2 className="text-xl font-semibold">Les achats en ligne ne sont pas encore disponibles.</h2>
            <p className="mt-4 leading-7 text-slate-300">
              Nous finalisons le paiement sécurisé et l&apos;accès aux téléchargements. Aucun paiement ne sera demandé pendant cette phase de lancement.
            </p>
            <Link href="/shop" className="mt-6 inline-flex rounded-full border border-cyan-400/30 px-5 py-3 text-sm font-semibold text-cyan-200 hover:bg-cyan-400/10">
              Retour au catalogue
            </Link>
          </section>

          <aside className="h-fit rounded-2xl border border-cyan-400/15 bg-slate-900/80 p-6 lg:sticky lg:top-6">
            <h2 className="text-xl font-semibold">Résumé</h2>
            <div className="mt-6 rounded-xl border border-slate-700 bg-slate-950/60 p-4">
              <div className="flex items-start justify-between gap-4"><div><div className="font-semibold">Claude Ops Playbook</div><div className="mt-1 text-sm text-slate-400">Achat non disponible</div></div><span className="font-semibold text-cyan-300">€49</span></div>
            </div>
            <div className="mt-5 space-y-3 text-sm text-slate-300"><div className="flex justify-between"><span>Sous-total</span><span>€49</span></div><div className="flex justify-between"><span>TVA</span><span>€0</span></div></div>
            <div className="mt-5 flex items-center justify-between border-t border-slate-700 pt-5 text-lg font-bold"><span>Total</span><span>€49</span></div>
            <p className="mt-4 text-sm leading-6 text-slate-400">Aucun paiement n&apos;est activé pour le moment.</p>
            <Link href="/shop" className="mt-4 block text-center text-sm font-medium text-slate-400 hover:text-cyan-300">Continuer mes achats</Link>
          </aside>
        </div>
      </div>
    </main>
  );
}
