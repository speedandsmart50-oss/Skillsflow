"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

type CustomerOrder = {
  id: string;
  total: number;
  total_xof: number | null;
  currency: string;
  coupon_code: string | null;
  payment_status: "pending" | "paid" | "failed";
  created_at: string;
  paid_at: string | null;
  products: { name: string; slug: string } | null;
};

export function AccountOrders() {
  const router = useRouter();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [role, setRole] = useState<"customer" | "admin">("customer");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [downloadPendingId, setDownloadPendingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const supabase = getSupabaseClient();
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!data.session) {
          router.push("/login?next=%2Faccount");
          return;
        }

        setEmail(data.session.user.email ?? "");
        const response = await fetch("/api/account/orders", {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
          cache: "no-store",
        });
        const payload: unknown = await response.json();
        if (!response.ok) {
          const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Impossible de charger vos commandes.";
          throw new Error(message);
        }
        if (!active || typeof payload !== "object" || payload === null || !("orders" in payload) || !Array.isArray(payload.orders)) return;
        setOrders(payload.orders as CustomerOrder[]);
        if ("role" in payload && payload.role === "admin") setRole("admin");
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Impossible de charger votre compte.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [router]);

  async function signOut() {
    const { error: signOutError } = await getSupabaseClient().auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      return;
    }
    router.push("/");
  }

  async function downloadOrder(orderId: string) {
    setError("");
    setDownloadPendingId(orderId);

    try {
      const { data, error: sessionError } = await getSupabaseClient().auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        router.push("/login?next=%2Faccount%2Fdownloads");
        return;
      }

      const response = await fetch(`/api/account/download?orderId=${encodeURIComponent(orderId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const payload: unknown = await response.json();
      if (
        !response.ok
        || typeof payload !== "object"
        || payload === null
        || !("downloadUrl" in payload)
        || typeof payload.downloadUrl !== "string"
      ) {
        const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "Impossible de préparer le téléchargement.";
        throw new Error(message);
      }

      window.location.assign(payload.downloadUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de préparer le téléchargement.");
    } finally {
      setDownloadPendingId(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[0.8rem] font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Espace client
          </p>
          <h1 className="mt-3 text-[3rem] font-bold tracking-[-0.06em] text-white sm:text-[4rem]">
            Mes commandes
          </h1>
          {email && <p className="mt-3 text-[1.2rem] text-slate-300">{email}</p>}
          {role === "admin" && (
            <Link href="/admin" className="mt-3 inline-flex text-sm font-semibold text-cyan-300 hover:text-cyan-100">
              Ouvrir l’administration
            </Link>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full border border-cyan-300/50 bg-transparent px-5 py-2.5 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/10"
          >
            Actualiser
          </button>
          <button
            type="button"
            onClick={signOut}
            className="rounded-full border border-slate-300/50 bg-transparent px-5 py-2.5 text-[1.05rem] font-medium text-slate-200 transition hover:border-slate-200 hover:text-white"
          >
            Se déconnecter
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-xl bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-8 text-[1.1rem] text-slate-300">Chargement de vos commandes…</p>
      ) : orders.length === 0 ? (
        <section className="mt-10 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <p className="text-[2rem] font-medium leading-tight text-slate-900">
            Aucune commande pour le moment.
          </p>
          <Link href="/shop" className="mt-6 inline-flex text-[1.5rem] font-medium text-slate-900 underline decoration-2 underline-offset-4">
            Voir le catalogue
          </Link>
        </section>
      ) : (
        <ul className="mt-10 space-y-5">
          {orders.map((order) => (
            <li key={order.id} className="rounded-[1.75rem] border border-slate-200 bg-white p-7 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <h2 className="text-[1.8rem] font-semibold tracking-[-0.04em] text-slate-900">
                    {order.products?.name ?? "Produit SkillFlow"}
                  </h2>
                  <p className="mt-2 text-[1.05rem] text-slate-500">
                    {new Date(order.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-[1.7rem] font-semibold text-slate-900">€{Number(order.total).toFixed(2)}</p>
                  <p className="text-[1.05rem] text-slate-500">
                    {new Intl.NumberFormat("fr-FR").format(order.total_xof ?? 0)} XOF
                  </p>
                </div>
              </div>

              <p className="mt-5 text-[1.05rem] text-slate-700">
                Statut : {order.payment_status === "paid" ? "Payé" : order.payment_status === "failed" ? "Échec" : "En attente"}
                {order.coupon_code && ` · Code ${order.coupon_code}`}
              </p>
              {order.payment_status === "paid" ? (
                <button
                  type="button"
                  disabled={downloadPendingId === order.id}
                  onClick={() => void downloadOrder(order.id)}
                  className="mt-4 rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-bold text-slate-950 disabled:cursor-wait disabled:opacity-60"
                >
                  {downloadPendingId === order.id ? "Préparation…" : "Télécharger le pack"}
                </button>
              ) : (
                <p className="mt-2 text-[1.05rem] text-slate-500">
                  Le téléchargement sera disponible après confirmation du paiement.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
