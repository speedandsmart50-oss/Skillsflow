"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";
import { calculateProductPrice, InvalidCouponError } from "@/lib/pricing";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Product } from "@/types/skillflow";

function formatXof(amount: number): string {
  return new Intl.NumberFormat("fr-FR").format(amount);
}

export function CheckoutForm({ product, salesEnabled }: { product: Product; salesEnabled: boolean }) {
  const router = useRouter();
  const [coupon, setCoupon] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const requestId = useRef<string | null>(null);
  let price: ReturnType<typeof calculateProductPrice>;
  try {
    price = calculateProductPrice(coupon, product.slug, product.price, product.priceXof);
  } catch (caught) {
    if (!(caught instanceof InvalidCouponError)) throw caught;
    price = calculateProductPrice("", product.slug, product.price, product.priceXof);
  }

  async function startCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);

    try {
      const supabase = getSupabaseClient();
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        router.push(`/login?next=${encodeURIComponent(`/checkout?product=${product.slug}`)}`);
        return;
      }

      requestId.current ??= crypto.randomUUID();
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ coupon, productSlug: product.slug, requestId: requestId.current }),
      });
      const result: unknown = await response.json();
      if (!response.ok || typeof result !== "object" || result === null || !("checkoutUrl" in result) || typeof result.checkoutUrl !== "string") {
        const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
          ? result.error
          : "Impossible de démarrer le paiement.";
        throw new Error(message);
      }

      window.location.assign(result.checkoutUrl);
    } catch (caught) {
      requestId.current = null;
      setError(caught instanceof Error ? caught.message : "Impossible de démarrer le paiement.");
      setPending(false);
    }
  }

  return (
    <main className="bg-[#0d1321] px-4 py-12 text-white sm:px-6 lg:px-8 lg:py-16">
      <div className="mx-auto max-w-[900px]">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Catalogue SkillFlow</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">Vérifier la commande</h1>
        <p className="mt-4 max-w-2xl leading-7 text-slate-300">
          Le paiement est traité par SasPay. Votre commande et l’accès au pack seront confirmés après vérification du paiement.
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Le montant en XOF correspond au prix SkillFlow. SasPay peut afficher des frais opérateur supplémentaires avant votre autorisation ; vérifiez le montant débité sur la page SasPay avant de confirmer.
        </p>

        <form onSubmit={startCheckout} className="mt-8 grid gap-8 lg:grid-cols-[1fr_0.8fr]">
          <section className="rounded-2xl border border-cyan-400/15 bg-slate-900/60 p-6 sm:p-8">
            <h2 className="text-xl font-semibold">{product.name}</h2>
            <p className="mt-2 text-sm text-slate-400">Compte SkillFlow obligatoire pour suivre l’achat.</p>
            <label htmlFor="coupon" className="mt-8 block text-sm font-medium text-slate-200">Code promo (optionnel)</label>
            <div className="mt-2 flex gap-2">
              <input id="coupon" value={coupon} onChange={(event) => setCoupon(event.target.value)} autoCapitalize="characters" autoComplete="off" className="min-w-0 flex-1 rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-cyan-300" />
            </div>
            {coupon.trim() && price.couponCode !== coupon.trim().toUpperCase() && (
              <p className="mt-2 text-sm text-amber-300">Code invalide ou non autorisé pour ce compte.</p>
            )}
            {!salesEnabled && (
              <div role="status" className="mt-8 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm leading-6 text-amber-100">
                Les ventes ne sont pas encore ouvertes. Revenez bientôt.
              </div>
            )}
            {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
            <button disabled={!salesEnabled || pending || (coupon.trim() !== "" && price.couponCode !== coupon.trim().toUpperCase())} type="submit" className="mt-6 w-full rounded-full bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
              {!salesEnabled ? "Ventes fermées" : pending ? "Préparation du paiement…" : "Payer"}
            </button>
          </section>

          <aside className="h-fit rounded-2xl border border-cyan-400/15 bg-slate-900/80 p-6">
            <h2 className="text-xl font-semibold">Résumé</h2>
            <div className="mt-6 flex justify-between gap-4 text-sm text-slate-300">
              <span>Prix du produit</span><span>€{price.subtotalEur.toFixed(2)}</span>
            </div>
            {price.discountEur > 0 && (
              <div className="mt-3 flex justify-between gap-4 text-sm text-emerald-300">
                <span>Coupon BOOST</span><span>−€{price.discountEur.toFixed(2)}</span>
              </div>
            )}
            <div className="mt-5 flex justify-between border-t border-slate-700 pt-5 text-lg font-bold">
              <span>Total</span><span>€{price.totalEur.toFixed(2)}</span>
            </div>
            <p className="mt-2 text-sm text-slate-400">{formatXof(price.totalXof)} XOF</p>
            <p className="mt-4 border-t border-slate-700 pt-4 text-xs leading-5 text-slate-500">L’accès est activé uniquement après confirmation du paiement. <Link href="/legal" className="text-cyan-200 underline underline-offset-2">Conditions de vente</Link></p>
            <Link href="/shop" className="mt-6 block text-center text-sm font-medium text-slate-400 hover:text-cyan-300">Retour au catalogue</Link>
          </aside>
        </form>
      </div>
    </main>
  );
}
