"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { AccountCatalog } from "@/components/account-catalog";
import { useMemberPreferences } from "@/components/member-preferences-provider";

type AccountOrder = {
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

type AccountSkill = {
  entitlementId: string;
  productId: string;
  slug: string;
  memberSkillSlug: string | null;
  name: string;
  description: string;
  domain: string;
  grantedAt: string;
  version: string;
  hasClaudeFile: boolean;
  hasChatGptFile: boolean;
  hasArchive: boolean;
};

type McpKey = {
  id: string;
  status: "active" | "revoked";
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
};

type SupportTicket = {
  id: string;
  category: "question" | "refund" | "other" | "suggestion";
  subject: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  created_at: string;
  updated_at: string;
};

type AccountData = {
  user: { id: string; email: string };
  orders: AccountOrder[];
  skills: AccountSkill[];
  mcpKeys: McpKey[];
  tickets: SupportTicket[];
};

type Section = "overview" | "skills" | "catalog" | "mcp" | "billing" | "privacy" | "help";

const sections: { id: Section; label: string }[] = [
  { id: "overview", label: "Vue d’ensemble" },
  { id: "skills", label: "Mes skills" },
  { id: "catalog", label: "Catalogue" },
  { id: "mcp", label: "Tutoriel Claude" },
  { id: "billing", label: "Facturation" },
  { id: "privacy", label: "Données et confidentialité" },
  { id: "help", label: "Aide" },
];

const pageClass = "min-h-screen bg-[#0b1020] text-slate-100";
const cardClass = "account-card rounded-3xl border border-white/10 bg-[#111a2b]/90 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.2)] sm:p-7";
const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-cyan-200 disabled:cursor-wait disabled:opacity-60";
const secondaryButtonClass = "inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-cyan-200 disabled:cursor-wait disabled:opacity-60";
const inputClass = "min-h-11 w-full rounded-xl border border-white/15 bg-[#0b1524] px-3.5 py-2.5 text-base text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-300";
const subscribeToLocation = () => () => {};
const getBrowserOrigin = () => window.location.origin;
const getServerOrigin = () => "";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseAccountData(payload: unknown): AccountData {
  if (
    !isRecord(payload)
    || !isRecord(payload.user)
    || typeof payload.user.id !== "string"
    || typeof payload.user.email !== "string"
    || !Array.isArray(payload.orders)
    || !Array.isArray(payload.skills)
    || !Array.isArray(payload.mcpKeys)
    || !Array.isArray(payload.tickets)
  ) {
    throw new Error("Les informations reçues ne sont pas valides.");
  }

  return {
    user: { id: payload.user.id, email: payload.user.email },
    orders: payload.orders as AccountOrder[],
    skills: payload.skills as AccountSkill[],
    mcpKeys: payload.mcpKeys as McpKey[],
    tickets: payload.tickets as SupportTicket[],
  };
}

async function accountRequest(path: string, init: RequestInit = {}) {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Votre session a expiré. Reconnectez-vous pour continuer.");

  const response = await fetch(path, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
  });
  return response;
}

async function responseError(response: Response, fallback: string) {
  const payload: unknown = await response.json().catch(() => null);
  if (isRecord(payload) && typeof payload.error === "string") {
    return payload.error;
  }
  return fallback;
}

function statusLabel(status: AccountOrder["payment_status"]) {
  if (status === "paid") return "Payée";
  if (status === "failed") return "Échec du paiement";
  return "En attente";
}

function ticketStatusLabel(status: SupportTicket["status"]) {
  if (status === "in_progress") return "En cours";
  if (status === "resolved") return "Résolue";
  if (status === "closed") return "Fermée";
  return "Reçue";
}

export function AccountDashboard() {
  const router = useRouter();
  const { profile } = useMemberPreferences();
  const [section, setSection] = useState<Section>("overview");
  const [account, setAccount] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [mcpUrlCopied, setMcpUrlCopied] = useState(false);
  const [newMcpKey, setNewMcpKey] = useState("");
  const [showDeleteForm, setShowDeleteForm] = useState(false);
  const [deleteWord, setDeleteWord] = useState("");
  const [deleteEmail, setDeleteEmail] = useState("");

  const browserOrigin = useSyncExternalStore(subscribeToLocation, getBrowserOrigin, getServerOrigin);
  const mcpUrl = browserOrigin ? `${browserOrigin}/api/mcp` : "";

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await accountRequest("/api/account/dashboard");
        if (response.status === 401) {
          router.push("/login?next=%2Faccount");
          return;
        }
        if (!response.ok) {
          throw new Error(await responseError(response, "Impossible de charger votre espace."));
        }
        const payload = parseAccountData(await response.json());
        if (active) setAccount(payload);
      } catch (caught) {
        if (active) {
          const message = caught instanceof Error ? caught.message : "Impossible de charger votre espace.";
          setError(message);
          if (message.includes("session a expiré")) router.push("/login?next=%2Faccount");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [router]);

  function clearFeedback() {
    setError("");
    setNotice("");
  }

  function changeSection(next: Section) {
    if (next !== "mcp") setNewMcpKey("");
    setSection(next);
  }

  async function refreshAccount() {
    const response = await accountRequest("/api/account/dashboard");
    if (!response.ok) throw new Error(await responseError(response, "Impossible d’actualiser votre espace."));
    setAccount(parseAccountData(await response.json()));
  }

  async function signOut() {
    clearFeedback();
    const { error: signOutError } = await getSupabaseClient().auth.signOut();
    if (signOutError) {
      setError("La déconnexion a échoué. Réessayez.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  async function copyMcpUrl() {
    if (!mcpUrl) return;
    try {
      await navigator.clipboard.writeText(mcpUrl);
      setMcpUrlCopied(true);
    } catch {
      setError("La copie automatique n’a pas fonctionné. Sélectionnez l’adresse du serveur et copiez-la.");
    }
  }

  async function createMcpKey() {
    clearFeedback();
    if (account?.mcpKeys.some((key) => key.status === "active") && !window.confirm("Créer une nouvelle clé révoquera l’ancienne. Continuer ?")) return;
    setPending(true);
    try {
      const response = await accountRequest("/api/account/mcp-keys", { method: "POST" });
      if (!response.ok) throw new Error(await responseError(response, "Impossible de créer la clé MCP."));
      const payload: unknown = await response.json();
      if (!isRecord(payload) || !isRecord(payload.key) || typeof payload.key.value !== "string") throw new Error("La clé reçue est invalide.");
      setNewMcpKey(payload.key.value);
      await refreshAccount();
      setNotice("Clé créée. Copiez-la maintenant : elle ne sera plus affichée après cette étape.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de créer la clé MCP.");
    } finally {
      setPending(false);
    }
  }

  async function revokeMcpKey() {
    clearFeedback();
    if (!window.confirm("Révoquer votre clé MCP ? Les connexions actuelles cesseront de fonctionner.")) return;
    setPending(true);
    try {
      const response = await accountRequest("/api/account/mcp-keys", { method: "DELETE" });
      if (!response.ok) throw new Error(await responseError(response, "Impossible de révoquer la clé MCP."));
      setNewMcpKey("");
      await refreshAccount();
      setNotice("Clé MCP révoquée.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de révoquer la clé MCP.");
    } finally {
      setPending(false);
    }
  }

  async function exportData() {
    clearFeedback();
    setPending(true);
    try {
      const response = await accountRequest("/api/account/data-export");
      if (!response.ok) throw new Error(await responseError(response, "Impossible d’exporter vos données."));
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `skillflow-donnees-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      setNotice("Votre export a été téléchargé.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible d’exporter vos données.");
    } finally {
      setPending(false);
    }
  }

  async function downloadOrderReceipt(orderId: string) {
    clearFeedback();
    setPending(true);
    try {
      const response = await accountRequest(`/api/account/orders/${encodeURIComponent(orderId)}/receipt`);
      if (!response.ok) throw new Error(await responseError(response, "Impossible de télécharger le reçu."));
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `skillflow-recu-${orderId.slice(0, 8)}.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setNotice("Le reçu de paiement a été téléchargé.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de télécharger le reçu.");
    } finally {
      setPending(false);
    }
  }

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    if (!account || deleteWord !== "SUPPRIMER" || deleteEmail.trim().toLowerCase() !== account.user.email.toLowerCase()) {
      setError("Saisissez SUPPRIMER et votre adresse e-mail pour confirmer.");
      return;
    }

    setPending(true);
    try {
      const response = await accountRequest("/api/account/profile", {
        method: "DELETE",
        body: JSON.stringify({ confirmation: deleteWord, email: deleteEmail }),
      });
      if (!response.ok) throw new Error(await responseError(response, "La suppression du compte a échoué."));
      await getSupabaseClient().auth.signOut();
      router.replace("/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La suppression du compte a échoué.");
    } finally {
      setPending(false);
    }
  }

  async function createTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    setPending(true);
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    const selectedOrderId = String(form.get("orderId") ?? "");

    try {
      const response = await accountRequest("/api/account/support-tickets", {
        method: "POST",
        body: JSON.stringify({
          category: String(form.get("category") ?? "question"),
          subject: String(form.get("subject") ?? ""),
          message: String(form.get("message") ?? ""),
          ...(selectedOrderId ? { orderId: selectedOrderId } : {}),
        }),
      });
      if (!response.ok) throw new Error(await responseError(response, "Impossible d’envoyer votre demande."));
      formElement.reset();
      setNotice("Votre demande a bien été envoyée.");
      await refreshAccount();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible d’envoyer votre demande.");
    } finally {
      setPending(false);
    }
  }


  return (
    <main className={`app-shell-bare ${pageClass} font-[family-name:var(--font-instrument-sans)]`}>
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0B6A5A]">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0B6A5A] font-[family-name:var(--font-bricolage)] text-lg font-bold text-white">S</span>
            <span className="font-[family-name:var(--font-bricolage)] text-xl font-bold tracking-tight">SkillFlow</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/member/settings" aria-label="Ouvrir mon profil" className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-cyan-200/25 bg-cyan-300/10 font-semibold text-cyan-100 transition hover:border-cyan-200/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200">
              {profile?.avatarUrl ? <Image src={profile.avatarUrl} alt="" width={40} height={40} unoptimized className="h-full w-full object-cover" /> : (profile?.displayName || account?.user.email || "M").slice(0, 1).toUpperCase()}
            </Link>
            <Link href="/member/settings" className={secondaryButtonClass}>Profil &amp; apparence</Link>
            <button type="button" onClick={() => changeSection("mcp")} className={secondaryButtonClass}>Tutoriel Claude</button>
            <button type="button" onClick={() => void signOut()} className={secondaryButtonClass}>Se déconnecter</button>
          </div>
        </header>

        <div className="mt-9 border-b border-white/10 pb-6 sm:mt-12">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-cyan-300">Espace client</p>
          <h1 className="mt-2 font-[family-name:var(--font-bricolage)] text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Votre espace SkillFlow
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
            Vos skills, vos achats et votre agent personnel, réunis dans un espace cohérent.
          </p>
        </div>

        {(error || notice) && (
          <div className={`mt-5 rounded-2xl border p-4 text-sm ${error ? "border-[#E7B9B3] bg-[#FFF3F1] text-[#8A2F25]" : "border-[#B9D6CC] bg-[#EAF5F0] text-[#16473D]"}`} role={error ? "alert" : "status"}>
            {error || notice}
          </div>
        )}

        {loading ? (
          <p className="mt-8 text-sm text-[#52645E]" role="status">Chargement de votre espace…</p>
        ) : !account ? (
          <section className={`${cardClass} mt-8`} role="alert">
            <h2 className="font-[family-name:var(--font-bricolage)] text-xl font-semibold">Votre espace est momentanément indisponible</h2>
            <p className="mt-2 text-sm leading-6 text-[#52645E]">{error || "Réessayez dans quelques instants."}</p>
          </section>
        ) : (
          <div className="account-layout mt-7" aria-live="polite">
            <AccountSideNav title="Espace" ids={["overview", "skills", "catalog", "mcp"]} selected={section} onSelect={(id) => { clearFeedback(); changeSection(id); }} />
            <section className="account-content" key={section}>
            {section === "catalog" && <AccountCatalog />}
            {section === "overview" && (
              <div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <SummaryCard label="Skills accessibles" value={account.skills.length} detail="Vos accès actifs" />
                  <SummaryCard label="Commandes" value={account.orders.length} detail="Votre historique complet" />
                  <SummaryCard label="Tutoriel Claude" value="Disponible" detail="Connexion MCP" />
                </div>
                <section className={`${cardClass} mt-5`}>
                  <p className="text-sm font-semibold text-[#0B6A5A]">Bienvenue</p>
                  <h2 className="mt-2 font-[family-name:var(--font-bricolage)] text-2xl font-semibold">
                    {profile?.displayName || account.user.email}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#52645E]">
                    Retrouvez vos skills et le tutoriel pour les connecter à Claude.
                  </p>
                  {account.skills.length === 0 && (
                    <div className="mt-5 rounded-2xl bg-[#F1F6F4] p-4">
                      <p className="font-semibold">Aucun skill pour le moment.</p>
                      <Link href="/shop" className="mt-2 inline-flex min-h-10 items-center font-semibold text-[#0B6A5A] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B6A5A]">
                        Découvrir le catalogue
                      </Link>
                    </div>
                  )}
                </section>
                {account.orders[0] && (
                  <section className={`${cardClass} mt-5`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-[#52645E]">Dernière commande</p>
                        <h2 className="mt-1 font-[family-name:var(--font-bricolage)] text-xl font-semibold">
                          {account.orders[0].products?.name ?? "SkillFlow"}
                        </h2>
                      </div>
                      <button type="button" onClick={() => changeSection("billing")} className={secondaryButtonClass}>Voir la facturation</button>
                    </div>
                    <p className="mt-3 text-sm text-[#52645E]">
                      {statusLabel(account.orders[0].payment_status)} · {new Date(account.orders[0].created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </section>
                )}
              </div>
            )}

            {section === "skills" && (
              <div>
                <SectionHeading title="Mes skills" description="Vos accès disponibles dans votre compte." />
                {account.skills.length === 0 ? (
                  <EmptyState title="Aucun skill pour le moment" description="Vos accès apparaîtront ici après confirmation d’un paiement ou attribution d’un accès." href="/shop" linkLabel="Voir le catalogue" />
                ) : (
                  <ul className="mt-5 grid gap-4 lg:grid-cols-2">
                    {account.skills.map((skill) => (
                      <li key={skill.entitlementId} className={`${cardClass} flex flex-wrap items-center justify-between gap-4`}>
                        <h2 className="font-[family-name:var(--font-bricolage)] text-xl font-semibold">{skill.name}</h2>
                        <button type="button" onClick={() => changeSection("mcp")} className={buttonClass}>Tutoriel de connexion</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {section === "mcp" && (
              <section className={cardClass}>
                <SectionHeading title="Tutoriel de connexion à Claude" description="Connectez SkillFlow à votre compte Claude en quelques étapes." />
                <div className="mt-6 rounded-2xl border border-white/10 bg-[#0b1524] p-4">
                  <h3 className="font-semibold">Clé de connexion</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">Une clé est nécessaire pour accéder à vos skills depuis MCP. Elle est affichée une seule fois à sa création.</p>
                  {newMcpKey && <div className="mt-4 space-y-2"><label htmlFor="new-mcp-key" className="text-sm font-medium">Copiez cette clé dans la configuration de connexion Claude</label><input id="new-mcp-key" readOnly value={newMcpKey} onFocus={(event) => event.currentTarget.select()} className={`${inputClass} font-mono text-sm`} autoComplete="off" /><button type="button" className={secondaryButtonClass} onClick={() => void navigator.clipboard.writeText(newMcpKey).then(() => setNotice("Clé copiée."), () => setError("Copie impossible. Sélectionnez la clé et copiez-la."))}>Copier la clé</button><button type="button" className="ml-2 text-sm text-slate-400 underline" onClick={() => setNewMcpKey("")}>Masquer</button></div>}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button type="button" className={buttonClass} disabled={pending} onClick={() => void createMcpKey()}>{account?.mcpKeys.some((key) => key.status === "active") ? "Remplacer ma clé" : "Créer ma clé MCP"}</button>
                    {account?.mcpKeys.some((key) => key.status === "active") && <button type="button" className={secondaryButtonClass} disabled={pending} onClick={() => void revokeMcpKey()}>Révoquer ma clé</button>}
                  </div>
                </div>
                <ol className="mt-6 space-y-5">
                  <li className="flex gap-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0B6A5A] text-sm font-bold text-white">1</span><div><h3 className="font-semibold">Ouvrez les connecteurs Claude</h3><a href="https://claude.ai/settings/connectors" target="_blank" rel="noreferrer" className="mt-1 inline-flex text-sm font-semibold text-[#087F8C] underline underline-offset-4">Ouvrir les paramètres Claude ↗</a></div></li>
                  <li className="flex gap-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0B6A5A] text-sm font-bold text-white">2</span><div className="min-w-0 flex-1"><h3 className="font-semibold">Ajoutez SkillFlow</h3><p className="mt-1 text-sm leading-6 text-[#52645E]">Choisissez « Ajouter un connecteur personnalisé », puis indiquez le nom et l’adresse ci-dessous.</p><div className="mt-3 grid gap-3 sm:grid-cols-[10rem_1fr]"><input aria-label="Nom du connecteur" readOnly value="SkillFlow" className={inputClass} onFocus={(event) => event.currentTarget.select()} /><div className="flex flex-col gap-2 sm:flex-row"><input aria-label="Adresse du connecteur SkillFlow" readOnly value={mcpUrl} placeholder="Chargement…" className={`${inputClass} min-w-0 font-mono text-sm`} onFocus={(event) => event.currentTarget.select()} /><button type="button" onClick={() => void copyMcpUrl()} disabled={!mcpUrl} className={secondaryButtonClass}>{mcpUrlCopied ? "Copiée" : "Copier l’adresse"}</button></div></div></div></li>
                  <li className="flex gap-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0B6A5A] text-sm font-bold text-white">3</span><div><h3 className="font-semibold">Activez SkillFlow dans une conversation</h3><p className="mt-1 text-sm leading-6 text-[#52645E]">Dans Claude, ouvrez « Recherche et outils », puis sélectionnez SkillFlow.</p></div></li>
                </ol>
              </section>
            )}

            {section === "billing" && (
              <div>
                <SectionHeading title="Facturation" description="Consultez le statut et le montant de chaque commande." />
                {account.orders.length === 0 ? (
                  <EmptyState title="Aucune commande pour le moment" description="Vos achats confirmés apparaîtront ici." href="/shop" linkLabel="Voir le catalogue" />
                ) : (
                  <ul className="mt-5 space-y-3">
                    {account.orders.map((order) => (
                      <li key={order.id} className={cardClass}>
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <h2 className="font-[family-name:var(--font-bricolage)] text-xl font-semibold">{order.products?.name ?? "SkillFlow"}</h2>
                            <p className="mt-1 text-sm text-[#66766F]">Commande du {new Date(order.created_at).toLocaleDateString("fr-FR")}</p>
                            <p className="mt-2 text-sm text-[#52645E]">Référence {order.id}</p>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="font-semibold">€{Number(order.total).toFixed(2)}</p>
                            <p className="text-sm text-[#52645E]">{new Intl.NumberFormat("fr-FR").format(order.total_xof ?? 0)} XOF</p>
                            <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${order.payment_status === "paid" ? "bg-[#EAF5F0] text-[#16473D]" : order.payment_status === "failed" ? "bg-[#FFF0EE] text-[#8A2F25]" : "bg-[#FFF8E6] text-[#705717]"}`}>{statusLabel(order.payment_status)}</span>
                            {order.payment_status === "paid" && <button type="button" disabled={pending} onClick={() => void downloadOrderReceipt(order.id)} className={`${secondaryButtonClass} mt-3 w-full sm:w-auto`}>{pending ? "Préparation…" : "Télécharger le reçu PDF"}</button>}
                            {order.payment_status !== "paid" && <p className="mt-3 text-xs text-[#52645E]">Reçu disponible après paiement confirmé.</p>}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {section === "privacy" && (
              <div className="space-y-5">
                <section className={cardClass}>
                  <SectionHeading title="Vos données" description="Téléchargez une copie des informations rattachées à votre compte." />
                  <button type="button" disabled={pending} onClick={() => void exportData()} className={`${buttonClass} mt-5`}>
                    {pending ? "Préparation…" : "Exporter mes données"}
                  </button>
                </section>
                <section className={`${cardClass} border-[#E7C7C2]`}>
                  <h2 className="font-[family-name:var(--font-bricolage)] text-xl font-semibold text-[#762E25]">Supprimer mon compte</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6E524E]">
                    Cette action est définitive. Elle supprimera vos commandes, vos accès, vos clés MCP et vos demandes d’aide. Vous pourrez télécharger vos données avant de continuer.
                  </p>
                  {!showDeleteForm ? (
                    <button type="button" onClick={() => setShowDeleteForm(true)} className="mt-5 inline-flex min-h-11 items-center rounded-full border border-[#B9655A] px-5 py-2.5 text-sm font-semibold text-[#762E25] transition hover:bg-[#FFF3F1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#8A2F25]">
                      Commencer la suppression
                    </button>
                  ) : (
                    <form onSubmit={(event) => void deleteAccount(event)} className="mt-5 max-w-xl space-y-4">
                      <p className="text-sm font-semibold text-[#762E25]">Pour confirmer, saisissez SUPPRIMER et votre adresse e-mail.</p>
                      <div>
                        <label htmlFor="delete-word" className="mb-1.5 block text-sm font-semibold">Confirmation</label>
                        <input id="delete-word" value={deleteWord} onChange={(event) => setDeleteWord(event.target.value)} autoComplete="off" className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="delete-email" className="mb-1.5 block text-sm font-semibold">Adresse e-mail du compte</label>
                        <input id="delete-email" type="email" value={deleteEmail} onChange={(event) => setDeleteEmail(event.target.value)} autoComplete="email" className={inputClass} />
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button type="submit" disabled={pending || deleteWord !== "SUPPRIMER" || deleteEmail.trim().toLowerCase() !== account.user.email.toLowerCase()} className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#8A2F25] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#76251D] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#8A2F25] disabled:cursor-not-allowed disabled:opacity-50">
                          {pending ? "Suppression…" : "Supprimer définitivement"}
                        </button>
                        <button type="button" onClick={() => { setShowDeleteForm(false); setDeleteWord(""); setDeleteEmail(""); }} className={secondaryButtonClass}>Annuler</button>
                      </div>
                    </form>
                  )}
                </section>
              </div>
            )}

            {section === "help" && (
              <div>
                <SectionHeading title="Aide" description="Envoyez une question ou une demande de remboursement à l’équipe SkillFlow." />
                <section className={`${cardClass} mt-5`}>
                  <form onSubmit={(event) => void createTicket(event)} className="max-w-2xl space-y-4">
                    <div>
                      <label htmlFor="ticket-category" className="mb-1.5 block text-sm font-semibold">Type de demande</label>
                      <select id="ticket-category" name="category" className={inputClass}>
                        <option value="question">Question</option>
                        <option value="refund">Demande de remboursement</option>
                        <option value="other">Autre demande</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="ticket-order" className="mb-1.5 block text-sm font-semibold">Commande concernée, si besoin</label>
                      <select id="ticket-order" name="orderId" className={inputClass} defaultValue="">
                        <option value="">Aucune commande</option>
                        {account.orders.map((order) => (
                          <option key={order.id} value={order.id}>{order.products?.name ?? "SkillFlow"} · {new Date(order.created_at).toLocaleDateString("fr-FR")}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="ticket-subject" className="mb-1.5 block text-sm font-semibold">Objet</label>
                      <input id="ticket-subject" name="subject" required minLength={3} maxLength={160} className={inputClass} />
                    </div>
                    <div>
                      <label htmlFor="ticket-message" className="mb-1.5 block text-sm font-semibold">Votre message</label>
                      <textarea id="ticket-message" name="message" required minLength={10} maxLength={5000} rows={5} className={`${inputClass} min-h-32 resize-y`} />
                    </div>
                    <button type="submit" disabled={pending} className={buttonClass}>{pending ? "Envoi…" : "Envoyer la demande"}</button>
                  </form>
                </section>
                <section className={`${cardClass} mt-5`}>
                  <h2 className="font-[family-name:var(--font-bricolage)] text-xl font-semibold">Mes demandes</h2>
                  {account.tickets.length === 0 ? (
                    <p className="mt-3 text-sm text-[#66766F]">Vous n’avez pas encore envoyé de demande.</p>
                  ) : (
                    <ul className="mt-4 divide-y divide-[#E4ECE8]">
                      {account.tickets.map((ticket) => (
                        <li key={ticket.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                          <div>
                            <p className="font-semibold">{ticket.subject}</p>
                            <p className="mt-1 text-xs text-[#66766F]">{new Date(ticket.created_at).toLocaleDateString("fr-FR")}</p>
                          </div>
                          <span className="rounded-full bg-[#F1F6F4] px-3 py-1 text-xs font-semibold text-[#16473D]">{ticketStatusLabel(ticket.status)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            )}
            </section>
            <AccountSideNav title="Votre espace" ids={["billing", "privacy", "help"]} selected={section} onSelect={(id) => { clearFeedback(); changeSection(id); }} />
          </div>
        )}
      </div>
    </main>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <article className={cardClass}>
      <p className="text-sm font-medium text-[#66766F]">{label}</p>
      <p className="mt-2 font-[family-name:var(--font-bricolage)] text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-[#66766F]">{detail}</p>
    </article>
  );
}

function AccountSideNav({ title, ids, selected, onSelect }: {
  title: string;
  ids: Section[];
  selected: Section;
  onSelect: (id: Section) => void;
}) {
  return <nav aria-label={title} className="account-side-nav account-card rounded-2xl p-3">
    <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{title}</p>
    <ul className="space-y-1">{ids.map((id) => {
      const item = sections.find((entry) => entry.id === id);
      if (!item) return null;
      return <li key={id}><button type="button" aria-current={selected === id ? "page" : undefined} onClick={() => onSelect(id)} className={`account-nav-link flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${selected === id ? "is-active bg-cyan-300 text-slate-950" : "text-slate-300 hover:bg-white/[0.06] hover:text-white"}`}><span aria-hidden="true" className="text-xs">{id === "overview" ? "◈" : id === "skills" ? "✳" : id === "catalog" ? "▦" : id === "mcp" ? "⌘" : id === "billing" ? "＄" : id === "privacy" ? "◉" : "?"}</span>{item.label}</button></li>;
    })}<li><Link href="/community" className="account-nav-link flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-slate-300 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"><span aria-hidden="true" className="text-xs">✦</span>Communauté</Link></li></ul>
  </nav>;
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <>
      <h2 className="font-[family-name:var(--font-bricolage)] text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#52645E]">{description}</p>
    </>
  );
}

function EmptyState({ title, description, href, linkLabel }: { title: string; description: string; href: string; linkLabel: string }) {
  return (
    <section className={`${cardClass} mt-5`}>
      <h3 className="font-[family-name:var(--font-bricolage)] text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#52645E]">{description}</p>
      <Link href={href} className="mt-4 inline-flex min-h-10 items-center font-semibold text-[#0B6A5A] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B6A5A]">
        {linkLabel}
      </Link>
    </section>
  );
}
