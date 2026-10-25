"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

type Section = "overview" | "catalog" | "orders" | "customers" | "mcp" | "waitlist" | "support" | "settings";
type CatalogStatus = "a_venir" | "en_preparation" | "disponible";
type OrderStatus = "pending" | "paid" | "failed";
type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
type AdminSkill = {
  id: string;
  slug: string;
  name: string;
  description: string;
  domain: string;
  catalog_status: CatalogStatus;
  price_eur: number;
  price_xof: number;
  version: string;
  zip_path: string | null;
  archived_at: string | null;
};
type SkillVersion = {
  id: string;
  product_id: string;
  version: string;
  release_notes: string | null;
  status: "draft" | "published";
  published_at: string | null;
  claude_file_path: string | null;
  chatgpt_file_path: string | null;
  archive_path: string | null;
};
type AdminOrder = {
  id: string;
  user_id: string | null;
  product_id: string | null;
  total: number;
  total_xof: number | null;
  currency: string;
  payment_status: OrderStatus;
  created_at: string;
  paid_at: string | null;
  profiles: { email: string } | null;
  products: { name: string; slug: string } | null;
};
type Entitlement = {
  id: string;
  user_id: string;
  product_id: string;
  order_id: string | null;
  source: "payment" | "manual";
  status: "active" | "revoked";
  granted_at: string;
  revoked_at: string | null;
  products: { name: string; slug: string } | null;
};
type Customer = {
  id: string;
  email: string;
  role: "client" | "admin";
  created_at: string;
  orders: AdminOrder[];
  entitlements: Entitlement[];
};
type Metric = { sales: number; revenue_eur: number; revenue_xof: number; new_accounts: number; waitlist_signups: number };
type McpKey = {
  id: string;
  user_id: string;
  email: string;
  status: "active" | "revoked";
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
};
type WaitlistEntry = { id: string; email: string; source: string | null; created_at: string };
type SupportTicket = {
  id: string;
  user_id: string;
  order_id: string | null;
  category: "question" | "refund" | "other";
  subject: string;
  message: string;
  status: TicketStatus;
  created_at: string;
  email: string;
};
type Profile = { id: string; email: string; role: "client" | "admin"; created_at: string };
type AuditEntry = {
  id: string;
  actorEmail: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};
type AdminData = {
  sevenDays?: Metric;
  thirtyDays?: Metric;
  skills?: AdminSkill[];
  versions?: SkillVersion[];
  orders?: AdminOrder[];
  customers?: Customer[];
  keys?: McpKey[];
  entries?: WaitlistEntry[];
  tickets?: SupportTicket[];
  profiles?: Profile[];
  audit?: AuditEntry[];
  recentOrders?: AdminOrder[];
  revenueByDay?: { date: string; revenue_xof: number; sales: number }[];
  revenueByDay30?: { date: string; revenue_xof: number; sales: number }[];
};

const sections: { id: Section; label: string }[] = [
  { id: "overview", label: "Vue d’ensemble" },
  { id: "catalog", label: "Catalogue" },
  { id: "orders", label: "Commandes" },
  { id: "customers", label: "Clients" },
  { id: "mcp", label: "Accès MCP" },
  { id: "waitlist", label: "Liste d’attente" },
  { id: "support", label: "Assistance" },
  { id: "settings", label: "Paramètres" },
];

const cardClass = "admin-card rounded-3xl border border-[#D4E0DC] bg-white p-5 text-[#13211E] shadow-[0_12px_32px_rgba(19,33,30,0.08)] sm:p-7";
const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-full bg-[#0B6A5A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#07594B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#0B6A5A] disabled:cursor-wait disabled:opacity-60";
const secondaryButtonClass = "inline-flex min-h-11 items-center justify-center rounded-full border border-[#B9CEC7] bg-white px-4 py-2 text-sm font-semibold text-[#16473D] transition hover:bg-[#EFF6F3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#0B6A5A] disabled:cursor-wait disabled:opacity-60";
const dangerButtonClass = "inline-flex min-h-11 items-center justify-center rounded-full border border-[#B9655A] bg-white px-4 py-2 text-sm font-semibold text-[#762E25] transition hover:bg-[#FFF3F1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#8A2F25] disabled:opacity-60";
const inputClass = "min-h-11 w-full rounded-xl border border-[#8FA79F] bg-white px-3.5 py-2.5 text-base text-[#13211E] outline-none placeholder:text-[#687A74] focus-visible:border-[#087F8C] focus-visible:ring-2 focus-visible:ring-[#087F8C] focus-visible:ring-offset-2";
const labelClass = "mb-1.5 block text-sm font-semibold text-[#29413A]";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function adminRequest(path: string, init: RequestInit = {}) {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Votre session a expiré. Reconnectez-vous pour continuer.");

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  return fetch(path, { ...init, headers, cache: "no-store" });
}

async function responsePayload(response: Response): Promise<Record<string, unknown>> {
  const payload: unknown = await response.json().catch(() => null);
  if (!isRecord(payload)) {
    if (!response.ok) throw new Error("La demande n’a pas abouti.");
    throw new Error("Les informations reçues ne sont pas valides.");
  }
  if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "La demande n’a pas abouti.");
  return payload;
}

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "Jamais";
}

function formatMoney(value: number, currency: "EUR" | "XOF") {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: currency === "XOF" ? 0 : 2 }).format(value);
}

function statusText(status: string) {
  const labels: Record<string, string> = {
    a_venir: "À venir",
    en_preparation: "En préparation",
    disponible: "Disponible",
    pending: "En attente",
    paid: "Payée",
    failed: "Échec du paiement",
    active: "Active",
    revoked: "Révoquée",
    open: "Reçue",
    in_progress: "En cours",
    resolved: "Résolue",
    closed: "Fermée",
    published: "Publiée",
    draft: "Brouillon",
  };
  return labels[status] ?? status;
}

export function AdminDashboard() {
  const router = useRouter();
  const [section, setSection] = useState<Section>("overview");
  const [viewerId, setViewerId] = useState("");
  const [data, setData] = useState<AdminData>({});
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [orderFilter, setOrderFilter] = useState("");
  const [ticketFilter, setTicketFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    try {
      const { data: authData, error: authError } = await getSupabaseClient().auth.getUser();
      if (authError) throw authError;
      setLoading(true);
      setError("");
      setViewerId(authData.user?.id ?? "");
      const endpoint: Record<Section, string> = {
        overview: "/api/admin/dashboard",
        catalog: "/api/admin/skills",
        orders: `/api/admin/orders${orderFilter ? `?status=${encodeURIComponent(orderFilter)}` : ""}`,
        customers: `/api/admin/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`,
        mcp: "/api/admin/mcp-keys",
        waitlist: "/api/admin/waitlist",
        support: `/api/admin/support${ticketFilter ? `?status=${encodeURIComponent(ticketFilter)}` : ""}`,
        settings: "/api/admin/settings",
      };
      const response = await adminRequest(endpoint[section]);
      if (response.status === 401) {
        router.push("/login?next=%2Fadmin");
        return;
      }
      const payload = await responsePayload(response);
      if (section === "customers") {
        const skillsResponse = await adminRequest("/api/admin/skills");
        const skillsPayload = await responsePayload(skillsResponse);
        setData({
          customers: Array.isArray(payload.customers) ? payload.customers as Customer[] : [],
          skills: Array.isArray(skillsPayload.skills) ? skillsPayload.skills as AdminSkill[] : [],
        });
      } else {
        setData(payload as AdminData);
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Impossible de charger les données.";
      setError(message);
      if (message.includes("session a expiré")) router.push("/login?next=%2Fadmin");
    } finally {
      setLoading(false);
    }
  }, [orderFilter, router, search, section, ticketFilter]);

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, [loadData]);

  async function runAction(
    path: string,
    method: "POST" | "PATCH",
    body: unknown,
    successMessage: string,
  ): Promise<boolean> {
    setPending(true);
    setError("");
    setNotice("");
    try {
      const response = await adminRequest(path, { method, body: JSON.stringify(body) });
      await responsePayload(response);
      setNotice(successMessage);
      await loadData();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "L’action n’a pas abouti.");
      return false;
    } finally {
      setPending(false);
    }
  }

  async function createSkill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const success = await runAction("/api/admin/skills", "POST", {
      slug: form.get("slug"),
      name: form.get("name"),
      description: form.get("description"),
      domain: form.get("domain"),
      priceEur: Number(form.get("priceEur")),
      priceXof: Number(form.get("priceXof")),
      status: form.get("status"),
    }, "Le skill a été créé.");
    if (success) formElement.reset();
  }

  async function uploadVersion(event: FormEvent<HTMLFormElement>, skillId: string) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setPending(true);
    setError("");
    setNotice("");
    try {
      const response = await adminRequest(`/api/admin/skills/${skillId}/versions`, { method: "POST", body: form });
      await responsePayload(response);
      setNotice("Le fichier de la version a été enregistré.");
      formElement.reset();
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Le fichier n’a pas pu être envoyé.");
    } finally {
      setPending(false);
    }
  }

  async function downloadWaitlist() {
    setPending(true);
    setError("");
    try {
      const response = await adminRequest("/api/admin/waitlist?format=csv");
      if (!response.ok) throw new Error(await responseErrorMessage(response));
      const file = await response.blob();
      const url = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "liste-attente-skillflow.csv";
      anchor.click();
      URL.revokeObjectURL(url);
      setNotice("Le fichier de la liste d’attente a été téléchargé.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Le téléchargement a échoué.");
    } finally {
      setPending(false);
    }
  }

  async function responseErrorMessage(response: Response) {
    const payload: unknown = await response.json().catch(() => null);
    return isRecord(payload) && typeof payload.error === "string" ? payload.error : "Le téléchargement a échoué.";
  }

  async function handleArchive(skill: AdminSkill) {
    if (!window.confirm(`Archiver « ${skill.name} » ? Le skill ne sera plus visible dans le catalogue.`)) return;
    await runAction("/api/admin/skills", "PATCH", {
      id: skill.id,
      archive: true,
      confirmation: "ARCHIVER",
    }, "Le skill a été archivé.");
  }

  async function handleRestoreOrder(order: AdminOrder) {
    if (!window.confirm("Rétablir l’accès lié à cette commande payée ?")) return;
    await runAction("/api/admin/orders", "PATCH", {
      orderId: order.id,
      action: "restore_access",
      confirmation: "RELANCER",
    }, "L’accès a été rétabli.");
  }

  async function handleGrantAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runAction("/api/admin/customers", "POST", {
      action: "grant",
      userId: form.get("userId"),
      productId: form.get("productId"),
    }, "L’accès manuel a été accordé.");
  }

  async function handleImpersonateCustomer(customer: Customer) {
    const clientWindow = window.open("about:blank", "_blank");
    if (!clientWindow) {
      setError("Autorisez les fenêtres pop-up pour ouvrir l’espace client.");
      return;
    }
    setPending(true);
    setError("");
    setNotice("");
    try {
      const response = await adminRequest("/api/admin/customers", {
        method: "POST",
        body: JSON.stringify({ action: "impersonate", userId: customer.id }),
      });
      const payload = await responsePayload(response);
      if (typeof payload.actionLink !== "string") throw new Error("Le lien de connexion client est invalide.");
      clientWindow.location.href = payload.actionLink;
      setNotice(`L’espace de ${customer.email} s’ouvre dans un nouvel onglet.`);
    } catch (caught) {
      clientWindow.close();
      setError(caught instanceof Error ? caught.message : "Impossible d’ouvrir l’espace client.");
    } finally {
      setPending(false);
    }
  }

  async function handleRevokeAccess(entitlement: Entitlement) {
    if (!window.confirm("Retirer cet accès ? Le client ne pourra plus télécharger ce skill.")) return;
    await runAction("/api/admin/customers", "POST", {
      action: "revoke",
      entitlementId: entitlement.id,
      confirmation: "RETIRER",
    }, "L’accès a été retiré.");
  }

  async function handleRevokeKey(key: McpKey) {
    if (!window.confirm(`Révoquer la clé MCP du compte ${key.email} ?`)) return;
    await runAction("/api/admin/mcp-keys", "PATCH", {
      keyId: key.id,
      confirmation: "RÉVOQUER",
    }, "La clé MCP a été révoquée.");
  }

  async function handleTicketStatus(ticket: SupportTicket, nextStatus: TicketStatus) {
    const closing = nextStatus === "resolved" || nextStatus === "closed";
    if (closing && !window.confirm("Confirmer la clôture de cette demande ?")) return;
    await runAction("/api/admin/support", "PATCH", {
      ticketId: ticket.id,
      status: nextStatus,
      ...(closing ? { confirmation: "CONFIRMER" } : {}),
    }, "Le statut de la demande a été mis à jour.");
  }

  async function handleRoleChange(profile: Profile, role: "client" | "admin") {
    if (!window.confirm(`Confirmer le changement de rôle de ${profile.email} ?`)) return;
    await runAction("/api/admin/settings", "PATCH", {
      userId: profile.id,
      role,
      confirmation: "CHANGER LE RÔLE",
    }, "Le rôle du compte a été mis à jour.");
  }

  function updateSkill(event: FormEvent<HTMLFormElement>, skill: AdminSkill) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void runAction("/api/admin/skills", "PATCH", {
      id: skill.id,
      slug: form.get("slug"),
      name: form.get("name"),
      description: form.get("description"),
      domain: form.get("domain"),
      priceEur: Number(form.get("priceEur")),
      priceXof: Number(form.get("priceXof")),
      status: form.get("status"),
    }, "Les modifications du skill ont été enregistrées.");
  }

  return (
    <main className="admin-shell min-h-screen bg-[#070D18] text-[#EAF4FF]">
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="admin-brand-bar flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-cyan-400/20 bg-slate-950/90 p-4 shadow-[0_18px_60px_rgba(0,190,255,.08)] sm:p-5">
          <Link href="/" className="flex min-h-11 items-center gap-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0B6A5A]">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 to-cyan-600 font-[family-name:var(--font-bricolage)] text-lg font-bold text-slate-950">S</span>
            <span>
              <span className="block font-[family-name:var(--font-bricolage)] text-lg font-bold">SkillFlow</span>
              <span className="block text-xs text-slate-400">ADMIN CONSOLE</span>
            </span>
          </Link>
          <Link href="/account" className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 hover:border-cyan-400">Voir l’espace client</Link>
        </header>

        <nav aria-label="Navigation de l’administration" className="admin-main-nav mt-4 overflow-x-auto rounded-[1.75rem] border border-cyan-400/15 bg-slate-950/75 px-3 py-3 shadow-[0_16px_45px_rgba(0,0,0,.18)] sm:px-4">
          <div className="flex min-w-max gap-2">
            {sections.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSection(item.id);
                  setError("");
                  setNotice("");
                }}
                aria-current={section === item.id ? "page" : undefined}
                className={`admin-nav-link min-h-11 rounded-xl border px-4 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 ${
                  section === item.id ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300" : "border-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-900 hover:text-slate-100"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="mt-7">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">SkillFlow / {section}</p>
          <h1 className="mt-2 font-[family-name:var(--font-bricolage)] text-3xl font-bold tracking-tight sm:text-4xl">
            {sections.find((item) => item.id === section)?.label}
          </h1>
          {error && <p role="alert" className="mt-5 rounded-2xl border border-[#E7B9B3] bg-[#FFF3F1] p-4 text-sm text-[#8A2F25]">{error}</p>}
          {notice && <p role="status" className="mt-5 rounded-2xl border border-[#B9D6CC] bg-[#EAF5F0] p-4 text-sm text-[#16473D]">{notice}</p>}
          {loading ? <p className="mt-8 text-[#52645E]" role="status">Chargement des données…</p> : (
            <section className="admin-panel mt-6 space-y-5" key={section}>
              {section === "overview" && <Overview data={data} onRefresh={() => void loadData()} onViewOrders={() => setSection("orders")} />}

              {section === "catalog" && (
                <>
                  <section className={cardClass} aria-labelledby="create-skill-heading">
                    <h2 id="create-skill-heading" className="text-xl font-bold">Ajouter un skill</h2>
                    <p className="mt-2 text-sm leading-6 text-[#52645E]">Les prix sont indiqués en euros et en francs CFA. Un skill devient achetable seulement lorsque son statut est disponible et qu’un pack ZIP est publié.</p>
                    <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={(event) => void createSkill(event)}>
                      <Field label="Nom"><input className={inputClass} name="name" required minLength={2} maxLength={160} /></Field>
                      <Field label="Adresse du catalogue"><input className={inputClass} name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></Field>
                      <Field label="Domaine"><input className={inputClass} name="domain" required minLength={2} maxLength={120} /></Field>
                      <Field label="Statut"><select className={inputClass} name="status" defaultValue="en_preparation"><option value="a_venir">À venir</option><option value="en_preparation">En préparation</option><option value="disponible">Disponible</option></select></Field>
                      <Field label="Prix en euros"><input className={inputClass} name="priceEur" type="number" min="0" max="99999999" step="0.01" required /></Field>
                      <Field label="Prix en francs CFA"><input className={inputClass} name="priceXof" type="number" min="0" step="1" required /></Field>
                      <div className="sm:col-span-2"><Field label="Description"><textarea className={`${inputClass} min-h-28`} name="description" maxLength={5000} /></Field></div>
                      <div className="sm:col-span-2"><button className={buttonClass} type="submit" disabled={pending}>Créer le skill</button></div>
                    </form>
                  </section>
                  {(data.skills ?? []).length === 0 ? <EmptyState>Le catalogue ne contient encore aucun skill.</EmptyState> : (data.skills ?? []).map((skill) => (
                    <article key={skill.id} className={cardClass}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="text-xl font-bold">{skill.name}</h2>
                          <p className="mt-1 text-sm text-[#52645E]">{skill.slug} · {skill.domain}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${skill.archived_at ? "bg-[#FFF0EE] text-[#8A2F25]" : "bg-[#EAF5F0] text-[#16473D]"}`}>
                          {skill.archived_at ? "Archivé" : statusText(skill.catalog_status)}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[#52645E]">{skill.description || "Aucune description."}</p>
                      <p className="mt-3 text-sm font-semibold">{formatMoney(skill.price_eur, "EUR")} · {formatMoney(skill.price_xof, "XOF")} · Version actuelle {skill.version}</p>
                      <form className="mt-5 grid gap-3 border-t border-[#DCE7E3] pt-5 sm:grid-cols-2" onSubmit={(event) => updateSkill(event, skill)}>
                        <Field label="Nom"><input className={inputClass} name="name" defaultValue={skill.name} required minLength={2} maxLength={160} /></Field>
                        <Field label="Adresse du catalogue"><input className={inputClass} name="slug" defaultValue={skill.slug} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></Field>
                        <Field label="Domaine"><input className={inputClass} name="domain" defaultValue={skill.domain} required /></Field>
                        <Field label="Statut"><select className={inputClass} name="status" defaultValue={skill.catalog_status}><option value="a_venir">À venir</option><option value="en_preparation">En préparation</option><option value="disponible">Disponible</option></select></Field>
                        <Field label="Prix en euros"><input className={inputClass} name="priceEur" type="number" min="0" step="0.01" defaultValue={skill.price_eur} required /></Field>
                        <Field label="Prix en francs CFA"><input className={inputClass} name="priceXof" type="number" min="0" step="1" defaultValue={skill.price_xof} required /></Field>
                        <div className="sm:col-span-2"><Field label="Description"><textarea className={`${inputClass} min-h-24`} name="description" defaultValue={skill.description} maxLength={5000} /></Field></div>
                        <div className="flex flex-wrap gap-2 sm:col-span-2">
                          <button className={secondaryButtonClass} type="submit" disabled={pending}>Enregistrer les modifications</button>
                          {skill.archived_at
                            ? <button className={secondaryButtonClass} type="button" disabled={pending} onClick={() => void runAction("/api/admin/skills", "PATCH", { id: skill.id, restore: true, confirmation: "RESTAURER" }, "Le skill a été réactivé.")}>Réactiver le skill</button>
                            : <button className={dangerButtonClass} type="button" disabled={pending} onClick={() => void handleArchive(skill)}>Archiver le skill</button>}
                        </div>
                      </form>
                      <div className="mt-6 border-t border-[#DCE7E3] pt-5">
                        <h3 className="font-semibold">Fichiers et versions</h3>
                        <ul className="mt-3 space-y-2 text-sm text-[#52645E]">
                          {(data.versions ?? []).filter((version) => version.product_id === skill.id).map((version) => (
                            <li key={version.id} className="rounded-xl bg-[#F1F6F4] p-3">
                              <span className="font-semibold text-[#13211E]">v{version.version}</span> · {statusText(version.status)}
                              <span className="mt-1 block">Fichiers ajoutés : {[version.claude_file_path, version.chatgpt_file_path, version.archive_path].filter(Boolean).length}/3</span>
                              {version.release_notes && <span className="mt-1 block">{version.release_notes}</span>}
                            </li>
                          ))}
                          {(data.versions ?? []).filter((version) => version.product_id === skill.id).length === 0 && <li>Aucune version n’a été envoyée.</li>}
                        </ul>
                        <form className="mt-4 grid gap-3 rounded-2xl bg-[#F1F6F4] p-4 sm:grid-cols-2" onSubmit={(event) => void uploadVersion(event, skill.id)}>
                          <Field label="Version"><input className={inputClass} name="version" defaultValue={skill.version || "1.0.0"} pattern="[0-9]+[.][0-9]+[.][0-9]+([+-][0-9A-Za-z.-]+)?" required /></Field>
                          <Field label="Format"><select className={inputClass} name="format"><option value="claude">Claude, Markdown ou texte</option><option value="chatgpt">ChatGPT, Markdown ou texte</option><option value="archive">Pack complet, ZIP</option></select></Field>
                          <div className="sm:col-span-2"><Field label="Fichier"><input className={inputClass} name="file" type="file" accept=".md,.txt,.zip" required /><span className="mt-1 block text-xs text-[#50625D]">Taille maximale : 4 Mo.</span></Field></div>
                          <div className="sm:col-span-2"><Field label="Notes de version"><textarea className={`${inputClass} min-h-20`} name="releaseNotes" maxLength={2000} /></Field></div>
                          <label className="flex min-h-11 items-center gap-2 text-sm font-medium sm:col-span-2"><input name="publish" type="checkbox" value="true" className="h-4 w-4 accent-[#0B6A5A]" />Publier cette version</label>
                          <div className="sm:col-span-2"><button className={buttonClass} type="submit" disabled={pending}>Envoyer le fichier</button></div>
                        </form>
                      </div>
                    </article>
                  ))}
                </>
              )}

              {section === "orders" && (
                <>
                  <div className={cardClass}>
                    <Field label="Filtrer par statut"><select className={`${inputClass} max-w-sm`} value={orderFilter} onChange={(event) => setOrderFilter(event.target.value)}><option value="">Toutes les commandes</option><option value="pending">En attente</option><option value="paid">Payées</option><option value="failed">Échec du paiement</option></select></Field>
                  </div>
                  {(data.orders ?? []).length === 0 ? <EmptyState>Aucune commande ne correspond à ce filtre.</EmptyState> : (data.orders ?? []).map((order) => (
                    <article key={order.id} className={cardClass}>
                      <div className="flex flex-wrap justify-between gap-4">
                        <div className="min-w-0">
                          <h2 className="font-bold">{order.products?.name ?? "Skill SkillFlow"}</h2>
                          <p className="mt-1 break-all text-sm text-[#52645E]">{order.profiles?.email ?? "Compte non associé"}</p>
                          <p className="mt-1 text-sm text-[#52645E]">Commande créée le {formatDate(order.created_at)}</p>
                          <p className="mt-1 text-xs text-[#52645E]">Référence {order.id}</p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="font-bold">{formatMoney(order.total_xof ?? 0, "XOF")}</p>
                          <p className="text-sm text-[#52645E]">{formatMoney(order.total, "EUR")} · {statusText(order.payment_status)}</p>
                        </div>
                      </div>
                      {order.payment_status === "paid" && <button className={`${secondaryButtonClass} mt-4`} type="button" disabled={pending} onClick={() => void handleRestoreOrder(order)}>Rétablir l’accès</button>}
                    </article>
                  ))}
                </>
              )}

              {section === "customers" && (
                <>
                  <section className={cardClass}>
                    <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); setSearch(searchInput.trim()); }}>
                      <Field label="Rechercher par adresse e-mail"><input className={`${inputClass} sm:min-w-80`} type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} maxLength={100} /></Field>
                      <button className={secondaryButtonClass} type="submit">Rechercher</button>
                    </form>
                    <form className="mt-5 grid gap-3 border-t border-[#DCE7E3] pt-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(event) => void handleGrantAccess(event)}>
                      <Field label="Client"><select className={inputClass} name="userId" required defaultValue=""><option value="" disabled>Choisir un compte</option>{(data.customers ?? []).map((customer) => <option key={customer.id} value={customer.id}>{customer.email}</option>)}</select></Field>
                      <Field label="Skill"><select className={inputClass} name="productId" required defaultValue=""><option value="" disabled>Choisir un skill</option>{(data.skills ?? []).filter((skill) => !skill.archived_at).map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</select></Field>
                      <button className={buttonClass} type="submit" disabled={pending}>Accorder l’accès</button>
                    </form>
                  </section>
                  {(data.customers ?? []).length === 0 ? <EmptyState>Aucun compte ne correspond à cette recherche.</EmptyState> : (data.customers ?? []).map((customer) => (
                    <article key={customer.id} className={cardClass}>
                      <div className="flex flex-wrap justify-between gap-3">
                        <div><h2 className="break-all font-bold">{customer.email}</h2><p className="mt-1 text-sm text-[#52645E]">Compte créé le {formatDate(customer.created_at)}</p></div>
                        {customer.role === "client" && <button className={secondaryButtonClass} type="button" disabled={pending} onClick={() => void handleImpersonateCustomer(customer)}>Ouvrir l’espace client</button>}
                        <span className="rounded-full bg-[#EAF5F0] px-3 py-1 text-xs font-semibold text-[#16473D]">{customer.role === "admin" ? "Administrateur" : "Client"}</span>
                      </div>
                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <div><h3 className="font-semibold">Accès aux skills</h3>{customer.entitlements.length === 0 ? <p className="mt-2 text-sm text-[#52645E]">Aucun accès enregistré.</p> : <ul className="mt-2 space-y-2">{customer.entitlements.map((entitlement) => <li key={entitlement.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#F1F6F4] p-3 text-sm"><span>{entitlement.products?.name ?? "Skill"} · {statusText(entitlement.status)} · {entitlement.source === "manual" ? "Ajout manuel" : "Paiement"}</span>{entitlement.status === "active" && <button className={dangerButtonClass} type="button" disabled={pending} onClick={() => void handleRevokeAccess(entitlement)}>Retirer</button>}</li>)}</ul>}</div>
                        <div><h3 className="font-semibold">Commandes récentes</h3>{customer.orders.length === 0 ? <p className="mt-2 text-sm text-[#52645E]">Aucune commande enregistrée.</p> : <ul className="mt-2 space-y-2">{customer.orders.slice(0, 5).map((order) => <li key={order.id} className="rounded-xl bg-[#F1F6F4] p-3 text-sm">{order.products?.name ?? "Skill"} · {statusText(order.payment_status)} · {formatDate(order.created_at)}</li>)}</ul>}</div>
                      </div>
                    </article>
                  ))}
                </>
              )}

              {section === "mcp" && ((data.keys ?? []).length === 0 ? <EmptyState>Aucune clé MCP n’a été créée.</EmptyState> : (data.keys ?? []).map((key) => (
                <article key={key.id} className={cardClass}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0"><h2 className="break-all font-bold">{key.email}</h2><p className="mt-1 text-sm text-[#52645E]">Créée le {formatDate(key.created_at)}</p><p className="mt-1 text-sm text-[#52645E]">Dernière utilisation : {formatDate(key.last_used_at)}</p></div>
                    <span className="rounded-full bg-[#EAF5F0] px-3 py-1 text-xs font-semibold text-[#16473D]">{statusText(key.status)}</span>
                  </div>
                  {key.status === "active" && <button className={`${dangerButtonClass} mt-4`} type="button" disabled={pending} onClick={() => void handleRevokeKey(key)}>Révoquer la clé</button>}
                </article>
              )))}

              {section === "waitlist" && (
                <>
                  <section className={`${cardClass} flex flex-wrap items-center justify-between gap-4`}>
                    <p className="text-sm text-[#52645E]">{(data.entries ?? []).length} inscription(s) affichée(s), dans la limite de 5 000.</p>
                    <button className={secondaryButtonClass} type="button" disabled={pending || !data.entries?.length} onClick={() => void downloadWaitlist()}>Télécharger le CSV</button>
                  </section>
                  {(data.entries ?? []).length === 0 ? <EmptyState>La liste d’attente est vide pour le moment.</EmptyState> : (data.entries ?? []).map((entry) => (
                    <article key={entry.id} className={cardClass}>
                      <h2 className="break-all font-bold">{entry.email}</h2>
                      <p className="mt-1 text-sm text-[#52645E]">Inscription le {formatDate(entry.created_at)}{entry.source ? ` · Origine : ${entry.source}` : ""}</p>
                    </article>
                  ))}
                </>
              )}

              {section === "support" && (
                <>
                  <section className={cardClass}>
                    <p className="text-sm leading-6 text-[#52645E]">Les demandes de remboursement sont consultées ici. SkillFlow ne modifie pas le statut des paiements et n’envoie aucune demande de remboursement à SasPay.</p>
                    <div className="mt-4 max-w-sm"><Field label="Filtrer par statut"><select className={inputClass} value={ticketFilter} onChange={(event) => setTicketFilter(event.target.value)}><option value="">Toutes les demandes</option><option value="open">Reçues</option><option value="in_progress">En cours</option><option value="resolved">Résolues</option><option value="closed">Fermées</option></select></Field></div>
                  </section>
                  {(data.tickets ?? []).length === 0 ? <EmptyState>Aucune demande d’assistance pour le moment.</EmptyState> : (data.tickets ?? []).map((ticket) => (
                    <article key={ticket.id} className={cardClass}>
                      <div className="flex flex-wrap justify-between gap-3"><div><p className="text-sm text-[#52645E]">{ticket.email} · {ticket.category === "refund" ? "Demande de remboursement" : ticket.category === "question" ? "Question" : "Autre demande"}</p><h2 className="mt-1 text-lg font-bold">{ticket.subject}</h2></div><span className="rounded-full bg-[#EAF5F0] px-3 py-1 text-xs font-semibold text-[#16473D]">{statusText(ticket.status)}</span></div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#29413A]">{ticket.message}</p>
                      <p className="mt-3 text-xs text-[#52645E]">Reçue le {formatDate(ticket.created_at)}{ticket.order_id ? ` · Commande ${ticket.order_id}` : ""}</p>
                      {ticket.status !== "resolved" && ticket.status !== "closed" && <div className="mt-4 flex flex-wrap gap-2">{ticket.status === "open" && <button className={secondaryButtonClass} type="button" disabled={pending} onClick={() => void handleTicketStatus(ticket, "in_progress")}>Prendre en charge</button>}<button className={secondaryButtonClass} type="button" disabled={pending} onClick={() => void handleTicketStatus(ticket, "resolved")}>Marquer comme résolue</button><button className={dangerButtonClass} type="button" disabled={pending} onClick={() => void handleTicketStatus(ticket, "closed")}>Fermer la demande</button></div>}
                    </article>
                  ))}
                </>
              )}

              {section === "settings" && (
                <>
                  <section className={cardClass}>
                    <h2 className="text-xl font-bold">Rôles des comptes</h2>
                    <p className="mt-2 text-sm leading-6 text-[#52645E]">Le rôle administrateur est limité aux comptes de confiance. Un administrateur ne peut pas modifier son propre rôle ni retirer le dernier accès administrateur.</p>
                    <ul className="mt-4 space-y-2">{(data.profiles ?? []).map((profile) => <li key={profile.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F1F6F4] p-3"><div className="min-w-0"><p className="break-all font-semibold">{profile.email}</p><p className="text-xs text-[#52645E]">{profile.role === "admin" ? "Administrateur" : "Client"}</p></div>{profile.id !== viewerId && <select className={`${inputClass} max-w-48`} aria-label={`Rôle de ${profile.email}`} value={profile.role} disabled={pending} onChange={(event) => void handleRoleChange(profile, event.target.value as "client" | "admin")}><option value="client">Client</option><option value="admin">Administrateur</option></select>}</li>)}</ul>
                  </section>
                  <section className={cardClass}>
                    <h2 className="text-xl font-bold">Journal d’audit</h2>
                    <p className="mt-2 text-sm text-[#52645E]">Les demandes et les résultats des actions sensibles sont conservés dans ce journal.</p>
                    {(data.audit ?? []).length === 0 ? <p className="mt-4 text-sm text-[#52645E]">Aucune action enregistrée.</p> : <ol className="mt-4 space-y-3">{(data.audit ?? []).map((entry) => <li key={entry.id} className="rounded-xl bg-[#F1F6F4] p-3"><p className="break-all text-sm font-semibold">{entry.action} · {entry.actorEmail}</p><p className="mt-1 break-all text-xs text-[#52645E]">{entry.target_type}{entry.target_id ? ` · ${entry.target_id}` : ""} · {formatDate(entry.created_at)}</p><p className="mt-1 text-xs text-[#52645E]">Phase : {typeof entry.details?.phase === "string" ? entry.details.phase : "Enregistrée"}</p></li>)}</ol>}
                  </section>
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className={labelClass}>{label}</span>{children}</label>;
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className={`${cardClass} text-sm leading-6 text-[#52645E]`} role="status">{children}</p>;
}

function Overview({ data, onRefresh, onViewOrders }: { data: AdminData; onRefresh: () => void; onViewOrders: () => void }) {
  const [period, setPeriod] = useState<7 | 30>(7);
  const week = data.sevenDays;
  const metric = period === 7 ? week : data.thirtyDays;
  const points = period === 7 ? data.revenueByDay ?? [] : data.revenueByDay30 ?? [];
  const max = Math.max(1, ...points.map((point) => point.revenue_xof));
  const chartPoints = points.map((point, index) => `${index * (700 / Math.max(1, points.length - 1))},${150 - (point.revenue_xof / max) * 125}`).join(" ");
  return <div className="space-y-5">
    <section className="admin-overview-hero relative isolate overflow-hidden rounded-[2rem] border border-cyan-400/25 bg-[radial-gradient(ellipse_at_78%_15%,rgba(0,210,255,.17),transparent_38%),radial-gradient(ellipse_at_96%_100%,rgba(124,58,237,.16),transparent_32%),linear-gradient(115deg,#07111e,#0b1c2b_58%,#07111e)] p-5 shadow-[0_20px_70px_rgba(0,190,255,.09)] sm:p-8"><div className="relative z-10 flex flex-wrap items-end justify-between gap-5"><div><p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">Aperçu des performances</p><h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Vue d’ensemble<span className="text-cyan-300">.</span></h2><p className="mt-2 text-sm text-slate-300">Les performances de ta plateforme, calculées à partir des données réelles.</p></div><div className="flex items-center gap-2"><label className="sr-only" htmlFor="admin-period">Période</label><select id="admin-period" value={period} onChange={(event) => setPeriod(Number(event.target.value) as 7 | 30)} className="rounded-xl border border-slate-700 bg-slate-900/90 px-4 py-3 text-sm text-slate-200"><option value={7}>7 derniers jours</option><option value={30}>30 derniers jours</option></select><button type="button" onClick={onRefresh} className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200">↻ Actualiser</button></div></div><div aria-hidden="true" className="admin-hero-orbit pointer-events-none absolute -bottom-24 right-8 h-64 w-[48%] rounded-[50%] border border-cyan-400/15 sm:right-20" /></section>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard title={`Revenus encaissés · ${period} jours`} metric={metric} revenue /><MetricCard title={`Ventes confirmées · ${period} jours`} metric={metric} /><MetricCard title={`Nouveaux clients · ${period} jours`} metric={metric} accounts /><MetricCard title={`Liste d’attente · ${period} jours`} metric={metric} waiting /></div>
    <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
      <section className="admin-dash-card rounded-3xl border border-slate-800 bg-slate-900/70 p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-bold text-white">Flux de revenus <span className="text-cyan-300">↗</span></h3><p className="mt-1 text-sm text-slate-400">Évolution des paiements confirmés · FCFA · {period} jours</p></div><span className="rounded-lg border border-slate-700 px-3 py-2 text-xs uppercase text-slate-400">Données réelles</span></div>
        {points.some((point) => point.revenue_xof > 0) ? <><svg viewBox="0 0 700 175" role="img" aria-label="Courbe des revenus quotidiens en francs CFA" className="mt-6 h-56 w-full overflow-visible"><defs><linearGradient id="revenue-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#39e6f5" stopOpacity=".25"/><stop offset="100%" stopColor="#39e6f5" stopOpacity="0"/></linearGradient></defs>{[25,67,109,151].map((y) => <line key={y} x1="0" x2="700" y1={y} y2={y} stroke="#243348" strokeDasharray="4 8"/>)}<polygon points={`0,175 ${chartPoints} 700,175`} fill="url(#revenue-fill)"/><polyline points={chartPoints} fill="none" stroke="#39e6f5" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>{points.map((point, index) => <circle key={point.date} cx={index * (700 / Math.max(1, points.length - 1))} cy={150 - (point.revenue_xof / max) * 125} r="4" fill="#a78bfa"><title>{point.date} · {formatMoney(point.revenue_xof, "XOF")}</title></circle>)}</svg><div className="flex justify-between text-xs text-slate-500">{points.map((point) => <span key={point.date}>{new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "UTC" }).format(new Date(`${point.date}T12:00:00Z`))}</span>)}</div></> : <p className="mt-8 rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">Aucun paiement confirmé sur cette période.</p>}
        <div className="mt-5 flex justify-between border-t border-slate-800 pt-4 text-sm"><span className="text-slate-400">Total encaissé sur {period} jours</span><strong className="text-xl text-cyan-300">{formatMoney(metric?.revenue_xof ?? 0, "XOF")}</strong></div></section>
      <section className="admin-dash-card rounded-3xl border border-slate-800 bg-slate-900/70 p-5 sm:p-7"><h3 className="text-lg font-bold text-white">Activité récente</h3><p className="mt-1 text-sm text-slate-400">Comptes et liste d’attente</p><div className="mt-6 space-y-4">{[["Nouveaux comptes · 7 j", week?.new_accounts], ["Nouveaux comptes · 30 j", data.thirtyDays?.new_accounts], ["Liste d’attente · 7 j", week?.waitlist_signups], ["Liste d’attente · 30 j", data.thirtyDays?.waitlist_signups]].map(([label, count]) => <p key={String(label)} className="flex items-center justify-between border-b border-slate-800 pb-4 text-sm"><span className="text-slate-300">{label}</span><strong className="text-cyan-300">{count ?? 0}</strong></p>)}</div></section>
    </div>
    <section className="admin-dash-card overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70"><div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6"><div><h3 className="text-lg font-bold text-white">Commandes récentes</h3><p className="mt-1 text-sm text-slate-400">Dernières commandes enregistrées</p></div><button type="button" onClick={onViewOrders} className="rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-200 hover:border-cyan-400">Tout voir →</button></div>
      {(data.recentOrders ?? []).length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-y border-slate-800 text-xs uppercase tracking-wide text-slate-500"><tr>{["Référence", "Client", "Produit", "Montant", "Statut", "Date"].map((heading) => <th key={heading} className="px-5 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody>{data.recentOrders?.map((order) => <tr key={order.id} className="border-b border-slate-800/80 transition hover:bg-slate-800/50"><td className="px-5 py-4 font-bold text-cyan-300">{order.id.slice(0, 8).toUpperCase()}</td><td className="px-5 py-4 text-slate-300">{order.profiles?.email ?? "Compte supprimé"}</td><td className="px-5 py-4 text-slate-200">{order.products?.name ?? "Skill"}</td><td className="px-5 py-4 font-bold text-white">{formatMoney(order.currency === "XOF" ? (order.total_xof ?? order.total) : order.total, order.currency === "XOF" ? "XOF" : "EUR")}</td><td className="px-5 py-4"><span className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${order.payment_status === "paid" ? "bg-emerald-400/10 text-emerald-300" : order.payment_status === "pending" ? "bg-amber-400/10 text-amber-300" : "bg-rose-400/10 text-rose-300"}`}>{statusText(order.payment_status)}</span></td><td className="px-5 py-4 text-slate-400">{formatDate(order.created_at)}</td></tr>)}</tbody></table></div> : <p className="p-6 text-sm text-slate-400">Aucune commande enregistrée pour le moment.</p>}</section>
  </div>;
}

function MetricCard({ title, metric, revenue = false, accounts = false, waiting = false }: { title: string; metric?: Metric; revenue?: boolean; accounts?: boolean; waiting?: boolean }) {
  let value = "Indisponible";
  let extra = "";
  if (metric) {
    if (revenue) {
      value = formatMoney(metric.revenue_eur, "EUR");
      extra = formatMoney(metric.revenue_xof, "XOF");
    } else if (accounts) {
      value = new Intl.NumberFormat("fr-FR").format(metric.new_accounts);
    } else if (waiting) {
      value = new Intl.NumberFormat("fr-FR").format(metric.waitlist_signups);
    } else {
      value = new Intl.NumberFormat("fr-FR").format(metric.sales);
    }
  }
  return <article className="admin-dash-card rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-[0_16px_40px_rgba(0,0,0,.15)] transition hover:-translate-y-0.5 hover:border-cyan-400/50"><div className="flex items-center justify-between"><h2 className="text-sm font-medium text-slate-400">{title}</h2><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10 text-lg text-cyan-300">{revenue ? "◇" : accounts ? "♙" : "▤"}</span></div><p className="mt-5 text-3xl font-bold tracking-tight text-white">{value}</p>{extra && <p className="mt-1 text-sm text-slate-400">{extra}</p>}<div aria-hidden="true" className={`mt-5 h-1 rounded-full ${revenue ? "bg-cyan-300" : "bg-violet-400"}`} /></article>;
}
