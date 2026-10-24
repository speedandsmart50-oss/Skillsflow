"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

type AdminOrder = {
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

export function AdminDashboard() {
  const router = useRouter();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const supabase = getSupabaseClient();
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        const accessToken = data.session?.access_token;
        if (!accessToken) {
          router.push("/login?next=%2Fadmin");
          return;
        }

        const response = await fetch("/api/admin/dashboard", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });
        const payload: unknown = await response.json();
        if (!response.ok) {
          const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Impossible de charger l’administration.";
          throw new Error(message);
        }
        if (!active || typeof payload !== "object" || payload === null || !("orders" in payload) || !Array.isArray(payload.orders)) return;
        setOrders(payload.orders as AdminOrder[]);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Impossible de charger l’administration.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [router]);

  async function downloadLatestPack() {
    setError("");
    setDownloading(true);

    try {
      const { data, error: sessionError } = await getSupabaseClient().auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("Reconnectez-vous pour télécharger le pack.");

      const response = await fetch("/api/account/download?slug=prospection-ethique", {
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
      setDownloading(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Administration SkillFlow</p>
      <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-white">Commandes</h1>
      <button
        type="button"
        onClick={() => void downloadLatestPack()}
        disabled={downloading}
        className="mt-5 rounded-full border border-cyan-300/50 px-5 py-2.5 text-sm font-semibold text-cyan-100 disabled:opacity-60"
      >
        {downloading ? "Préparation…" : "Télécharger le pack publié"}
      </button>
      {error && <p role="alert" className="mt-6 rounded-xl bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}
      {loading ? (
        <p className="mt-8 text-slate-300">Chargement des commandes…</p>
      ) : orders.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-slate-700 p-6 text-slate-300">Aucune commande pour le moment.</p>
      ) : (
        <ul className="mt-8 space-y-4">
          {orders.map((order) => (
            <li key={order.id} className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-white">{order.products?.name ?? "Produit SkillFlow"}</h2>
                  <p className="mt-1 text-sm text-slate-400">{new Date(order.created_at).toLocaleString("fr-FR")}</p>
                  <p className="mt-2 text-sm text-slate-300">Référence {order.id}</p>
                </div>
                <div className="text-right text-slate-200">
                  <p className="font-bold">{new Intl.NumberFormat("fr-FR").format(order.total_xof ?? 0)} XOF</p>
                  <p className="text-sm text-slate-400">
                    {order.payment_status === "paid" ? "Payé" : order.payment_status === "failed" ? "Échec" : "En attente"}
                    {order.coupon_code && ` · ${order.coupon_code}`}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
