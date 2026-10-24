"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { AccountCatalog } from "@/components/account-catalog";
import { AccountConversations } from "@/components/account-conversations";

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
  category: "question" | "refund" | "other";
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

type Section = "overview" | "skills" | "catalog" | "mcp" | "agent" | "billing" | "privacy" | "help";

const sections: { id: Section; label: string }[] = [
  { id: "overview", label: "Vue d’ensemble" },
  { id: "skills", label: "Mes skills" },
  { id: "catalog", label: "Catalogue" },
  { id: "mcp", label: "Connexion MCP" },
  { id: "agent", label: "Mon agent IA" },
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
  const [section, setSection] = useState<Section>("overview");
  const [account, setAccount] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [downloadPending, setDownloadPending] = useState("");
  const [newKey, setNewKey] = useState("");
  const [keyCopied, setKeyCopied] = useState(false);
  const [mcpUrlCopied, setMcpUrlCopied] = useState(false);
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

  async function refreshAccount() {
    const response = await accountRequest("/api/account/dashboard");
    if (!response.ok) {
      throw new Error(await responseError(response, "Impossible d’actualiser votre espace."));
    }
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

  async function downloadSkill(skill: AccountSkill, format: "claude" | "chatgpt" | "archive") {
    clearFeedback();
    setDownloadPending(`${skill.productId}:${format}`);
    try {
      const params = new URLSearchParams({
        productId: skill.productId,
        version: skill.version,
        format,
      });
      const response = await accountRequest(`/api/account/download?${params}`);
      const payload: unknown = await response.json();
      if (
        !response.ok
        || !isRecord(payload)
        || typeof payload.downloadUrl !== "string"
      ) {
        throw new Error(isRecord(payload) && typeof payload.error === "string"
          ? payload.error
          : "Impossible de préparer le téléchargement.");
      }
      window.location.assign(payload.downloadUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de préparer le téléchargement.");
    } finally {
      setDownloadPending("");
    }
  }

  async function rotateKey() {
    clearFeedback();
    if (
      account?.mcpKeys.some((key) => key.status === "active")
      && !window.confirm("L’ancienne clé sera immédiatement révoquée. Continuer ?")
    ) {
      return;
    }

    setPending(true);
    try {
      const response = await accountRequest("/api/account/mcp-keys", { method: "POST" });
      const payload: unknown = await response.json();
      if (!response.ok || !isRecord(payload) || !isRecord(payload.key) || typeof payload.key.value !== "string") {
        throw new Error(isRecord(payload) && typeof payload.error === "string"
          ? payload.error
          : "Impossible de créer votre clé MCP.");
      }
      setNewKey(payload.key.value);
      setKeyCopied(false);
      setNotice("Votre nouvelle clé est prête. Copiez-la maintenant, elle ne sera plus affichée ensuite.");
      await refreshAccount();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de créer votre clé MCP.");
    } finally {
      setPending(false);
    }
  }

  async function revokeKey() {
    clearFeedback();
    if (!window.confirm("Révoquer la clé MCP ? Les connexions qui l’utilisent cesseront de fonctionner.")) return;

    setPending(true);
    try {
      const response = await accountRequest("/api/account/mcp-keys", { method: "DELETE" });
      if (!response.ok) throw new Error(await responseError(response, "Impossible de révoquer la clé."));
      setNewKey("");
      setNotice("La clé MCP a été révoquée.");
      await refreshAccount();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de révoquer la clé.");
    } finally {
      setPending(false);
    }
  }

  async function copyKey() {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setKeyCopied(true);
    } catch {
      setError("La copie automatique n’a pas fonctionné. Sélectionnez la clé et copiez-la.");
    }
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

  const activeKey = account?.mcpKeys.find((key) => key.status === "active");

  return (
    <main className={`app-shell-bare ${pageClass} font-[family-name:var(--font-instrument-sans)]`}>
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0B6A5A]">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0B6A5A] font-[family-name:var(--font-bricolage)] text-lg font-bold text-white">S</span>
            <span className="font-[family-name:var(--font-bricolage)] text-xl font-bold tracking-tight">SkillFlow</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden max-w-60 truncate text-sm text-[#52645E] sm:inline">{account?.user.email}</span>
            <Link href="/member/skills" className={secondaryButtonClass}>Bibliothèque IA</Link>
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
            <AccountSideNav title="Espace" ids={["overview", "skills", "catalog", "mcp"]} selected={section} onSelect={(id) => { clearFeedback(); setSection(id); if (id !== "mcp") setNewKey(""); }} />
            <section className="account-content" key={section}>
            {section === "catalog" && <AccountCatalog />}
            {section === "agent" && <AccountConversations />}
            {section === "overview" && (
              <div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <SummaryCard label="Skills accessibles" value={account.skills.length} detail="Vos accès actifs" />
                  <SummaryCard label="Commandes" value={account.orders.length} detail="Votre historique complet" />
                  <SummaryCard label="Connexion MCP" value="Disponible" detail={activeKey ? "Accès achats activé" : "Sans clé pour les skills gratuits"} />
                </div>
                <section className={`${cardClass} mt-5`}>
                  <p className="text-sm font-semibold text-[#0B6A5A]">Bienvenue</p>
                  <h2 className="mt-2 font-[family-name:var(--font-bricolage)] text-2xl font-semibold">
                    {account.user.email}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#52645E]">
                    Gérez ici vos accès, vos téléchargements et la connexion MCP. Vous pouvez aussi demander de l’aide ou exporter vos données.
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
                      <button type="button" onClick={() => setSection("billing")} className={secondaryButtonClass}>Voir la facturation</button>
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
                <SectionHeading title="Mes skills" description="Téléchargez les formats disponibles et retrouvez les conseils d’installation." />
                {account.skills.length === 0 ? (
                  <EmptyState title="Aucun skill pour le moment" description="Vos accès apparaîtront ici après confirmation d’un paiement ou attribution d’un accès." href="/shop" linkLabel="Voir le catalogue" />
                ) : (
                  <ul className="mt-5 grid gap-4 lg:grid-cols-2">
                    {account.skills.map((skill) => (
                      <li key={skill.entitlementId} className={cardClass}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#0B6A5A]">{skill.domain}</p>
                            <h2 className="mt-2 font-[family-name:var(--font-bricolage)] text-2xl font-semibold">{skill.name}</h2>
                          </div>
                          <span className="rounded-full bg-[#EAF5F0] px-3 py-1 text-xs font-semibold text-[#16473D]">v{skill.version}</span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[#52645E]">{skill.description}</p>
                        <p className="mt-3 text-xs text-[#66766F]">Accès accordé le {new Date(skill.grantedAt).toLocaleDateString("fr-FR")}</p>
                        <div className="mt-5 flex flex-wrap gap-2">
                          <FormatButton label="Télécharger pour Claude" available={skill.hasClaudeFile} pending={downloadPending === `${skill.productId}:claude`} onClick={() => void downloadSkill(skill, "claude")} />
                          <FormatButton label="Télécharger pour ChatGPT" available={skill.hasChatGptFile} pending={downloadPending === `${skill.productId}:chatgpt`} onClick={() => void downloadSkill(skill, "chatgpt")} />
                          {skill.hasArchive && (
                            <button type="button" disabled={Boolean(downloadPending)} onClick={() => void downloadSkill(skill, "archive")} className={secondaryButtonClass}>
                              {downloadPending === `${skill.productId}:archive` ? "Préparation…" : "Télécharger le pack complet"}
                            </button>
                          )}
                        </div>
                        <div className="mt-5 rounded-2xl bg-[#F1F6F4] p-4">
                          <h3 className="text-sm font-semibold">Guide d’installation</h3>
                          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-[#52645E]">
                            <li>Choisissez le format adapté à votre assistant.</li>
                            <li>Importez le fichier dans les réglages de votre assistant, ou copiez son contenu dans un projet.</li>
                            <li>Suivez le guide inclus dans le pack pour terminer l’installation.</li>
                          </ol>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {section === "mcp" && (
              <section className={cardClass}>
                <SectionHeading title="Connexion MCP" description="Ajoutez SkillFlow à votre assistant avec le nom et l’adresse du serveur. Aucune clé n’est nécessaire pour démarrer." />
                <div className="mt-5 rounded-2xl border border-white/10 bg-[#0b1524] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Serveur MCP</p>
                  <label className="mt-4 block text-sm font-semibold text-slate-200" htmlFor="mcp-server-name">Nom</label>
                  <input id="mcp-server-name" aria-label="Nom du serveur MCP" readOnly value="SkillFlow" className={`${inputClass} mt-2`} onFocus={(event) => event.currentTarget.select()} />
                  <label className="mt-4 block text-sm font-semibold text-slate-200" htmlFor="mcp-server-url">Adresse de connexion</label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input id="mcp-server-url" aria-label="Adresse du serveur MCP" readOnly value={mcpUrl} placeholder="Chargement de l’adresse…" className={`${inputClass} font-mono text-sm`} onFocus={(event) => event.currentTarget.select()} />
                    <button type="button" onClick={() => void copyMcpUrl()} disabled={!mcpUrl} className={secondaryButtonClass}>{mcpUrlCopied ? "Adresse copiée" : "Copier l’adresse"}</button>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">Dans les réglages MCP de Claude ou de votre autre assistant, ajoutez un serveur distant avec cette adresse. La connexion utilise Streamable HTTP.</p>
                </div>
                <div className="mt-4 rounded-2xl border border-cyan-200/20 bg-cyan-200/[0.06] p-4 text-sm leading-6 text-slate-200">
                  <p><strong className="text-cyan-100">Sans clé :</strong> rechercher le catalogue et consulter les skills gratuits.</p>
                  <p className="mt-1"><strong className="text-cyan-100">Après un achat :</strong> pour télécharger un pack privé depuis MCP, une clé liée à votre compte vérifie vos droits. Elle est facultative pour connecter le serveur.</p>
                </div>
                <details className="mt-5 rounded-2xl border border-white/10 p-4">
                  <summary className="min-h-10 cursor-pointer font-semibold text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200">Options avancées : accès aux achats</summary>
                  <div className="mt-3 rounded-2xl bg-white/[0.04] p-4">
                    <p className="font-semibold">{activeKey ? "Votre clé d’accès aux achats est active" : "Aucune clé d’accès aux achats"}</p>
                    {activeKey && <p className="mt-1 text-sm text-slate-300">Dernière utilisation : {activeKey.last_used_at ? new Date(activeKey.last_used_at).toLocaleString("fr-FR") : "pas encore utilisée"}</p>}
                    {newKey && <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input aria-label="Nouvelle clé MCP" readOnly value={newKey} className={`${inputClass} font-mono text-sm`} onFocus={(event) => event.currentTarget.select()} /><button type="button" onClick={() => void copyKey()} className={secondaryButtonClass}>{keyCopied ? "Clé copiée" : "Copier la clé"}</button></div>}
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button type="button" disabled={pending} onClick={() => void rotateKey()} className={buttonClass}>{pending ? "Création…" : activeKey ? "Régénérer la clé" : "Créer une clé d’accès"}</button>
                      {activeKey && <button type="button" disabled={pending} onClick={() => void revokeKey()} className={secondaryButtonClass}>Révoquer la clé</button>}
                    </div>
                    {activeKey && <p className="mt-3 text-xs text-slate-400">Créée le {new Date(activeKey.created_at).toLocaleString("fr-FR")}. Le lien de téléchargement MCP expire après 10 minutes.</p>}
                  </div>
                </details>
                {account.mcpKeys.some((key) => key.status === "revoked") && (
                  <details className="mt-5">
                    <summary className="min-h-10 cursor-pointer font-semibold text-[#16473D] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B6A5A]">Afficher les anciennes clés révoquées</summary>
                    <ul className="mt-2 space-y-2 text-sm text-[#66766F]">
                      {account.mcpKeys.filter((key) => key.status === "revoked").map((key) => (
                        <li key={key.id}>Révoquée le {key.revoked_at ? new Date(key.revoked_at).toLocaleString("fr-FR") : "date inconnue"}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </section>
            )}

            {section === "billing" && (
              <div>
                <SectionHeading title="Facturation" description="Consultez le statut et le montant de chaque commande." />
                <p className="mt-4 rounded-2xl border border-[#DCE7E3] bg-white p-4 text-sm leading-6 text-[#52645E]">
                  Les factures PDF ne sont pas encore disponibles. Votre historique de commandes reste accessible ci-dessous.
                </p>
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
            <AccountSideNav title="Votre espace" ids={["agent", "billing", "privacy", "help"]} selected={section} onSelect={(id) => { clearFeedback(); setSection(id); setNewKey(""); }} />
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
      return <li key={id}><button type="button" aria-current={selected === id ? "page" : undefined} onClick={() => onSelect(id)} className={`account-nav-link flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${selected === id ? "is-active bg-cyan-300 text-slate-950" : "text-slate-300 hover:bg-white/[0.06] hover:text-white"}`}><span aria-hidden="true" className="text-xs">{id === "overview" ? "◈" : id === "skills" ? "✳" : id === "catalog" ? "▦" : id === "mcp" ? "⌘" : id === "agent" ? "✦" : id === "billing" ? "＄" : id === "privacy" ? "◉" : "?"}</span>{item.label}</button></li>;
    })}</ul>
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

function FormatButton({ label, available, pending, onClick }: { label: string; available: boolean; pending: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={!available || pending} onClick={onClick} className={secondaryButtonClass} title={available ? undefined : "Ce format n’a pas encore été ajouté."}>
      {pending ? "Préparation…" : available ? label : `${label} · bientôt disponible`}
    </button>
  );
}
