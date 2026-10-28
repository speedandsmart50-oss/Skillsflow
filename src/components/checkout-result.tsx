"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

type PaymentResult = {
  status: "pending" | "paid" | "failed" | "expired" | "cancelled" | "refunded";
  amountXof: number;
  currency: string;
  paidAt: string | null;
  product: { name: string; slug: string } | null;
};

export function CheckoutResult({ orderId }: { orderId: string }) {
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [message, setMessage] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function checkPayment() {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const token = data.session?.access_token;
        if (!token) {
          if (active) setMessage("Reconnectez-vous au compte utilisé pour cet achat afin de consulter le paiement.");
          return;
        }

        const response = await fetch(`/api/payments/status?order=${encodeURIComponent(orderId)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const payload = await response.json() as PaymentResult | { error?: string };
        if (!response.ok || !("status" in payload)) {
          throw new Error("error" in payload ? payload.error : "Le statut du paiement est indisponible.");
        }
        if (!active) return;
        setResult(payload);
        setMessage("");
        if (payload.status === "pending" && attempts < 12) {
          attempts += 1;
          timer = setTimeout(checkPayment, 5000);
        }
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Le statut du paiement est indisponible.");
      } finally {
        if (active) setChecking(false);
      }
    }

    void checkPayment();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [orderId]);

  const paid = result?.status === "paid";
  const failed = result?.status === "failed" || result?.status === "expired" || result?.status === "cancelled";

  return (
    <main className="grid min-h-[70vh] place-items-center bg-[#0d1321] px-4 py-12 text-white">
      <section className="w-full max-w-xl rounded-2xl border border-cyan-400/15 bg-slate-900/70 p-8 text-center shadow-2xl sm:p-10" aria-live="polite">
        <span className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl ${paid ? "bg-emerald-300/10 text-emerald-300" : failed ? "bg-rose-300/10 text-rose-300" : "bg-cyan-300/10 text-cyan-200"}`} aria-hidden="true">
          {paid ? "✓" : failed ? "!" : checking ? "…" : "↻"}
        </span>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Commande Skillsflow</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">{paid ? "Paiement confirmé" : failed ? "Paiement non finalisé" : "Vérification du paiement"}</h1>
        <p className="mt-3 leading-7 text-slate-300">
          {paid
            ? `${result.product?.name ?? "Votre skill"} est maintenant associé à votre compte.`
            : failed
              ? "Aucun accès n’a été activé. Vous pouvez reprendre la commande depuis sa fiche."
              : result?.status === "pending"
                ? "Paiement en cours de vérification, activation sous quelques minutes. Cette page vérifie automatiquement le statut ; ne relancez pas un paiement en attente."
                : "Le statut est vérifié auprès de votre compte Skillsflow. Le retour de SasPay, à lui seul, ne valide jamais un paiement."}
        </p>
        {result && <p className="mt-4 text-sm text-slate-400">Commande {orderId.slice(0, 8)} · {new Intl.NumberFormat("fr-FR").format(result.amountXof)} {result.currency}</p>}
        {message && <p role="status" className="mt-4 text-sm text-amber-200">{message}</p>}
        {result?.status === "pending" && !checking && <p className="mt-3 text-xs text-slate-400">La confirmation n’est pas encore arrivée. Actualisez votre compte dans quelques instants.</p>}
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {paid ? (
            <Link href="/account" className="inline-flex rounded-full bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950">Accéder à mon skill</Link>
          ) : failed && result?.product ? (
            <Link href={`/checkout?product=${encodeURIComponent(result.product.slug)}`} className="inline-flex rounded-full bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950">Réessayer le paiement</Link>
          ) : null}
          <Link href="/account" className="inline-flex rounded-full border border-slate-600 px-5 py-3 text-sm font-bold text-slate-200">Mes commandes</Link>
        </div>
      </section>
    </main>
  );
}
