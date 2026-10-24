import Link from "next/link";

export default function CheckoutCompletePage() {
  return (
    <main className="grid min-h-[70vh] place-items-center bg-[#0d1321] px-4 text-white">
      <div className="max-w-lg rounded-2xl border border-cyan-400/15 bg-slate-900/60 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cyan-400/10 text-2xl text-cyan-300">✓</div>
        <h1 className="mt-5 text-3xl font-bold">Boutique bientôt disponible</h1>
        <p className="mt-3 text-slate-300">Les paiements et les téléchargements ne sont pas encore activés. Aucun paiement n&apos;a été confirmé par cette page.</p>
        <Link href="/shop" className="mt-6 inline-flex rounded-full bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950">Retour au catalogue</Link>
      </div>
    </main>
  );
}
