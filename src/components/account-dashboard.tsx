"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState, useSyncExternalStore, useMemo, useRef } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { AccountCatalog } from "@/components/account-catalog";
import { CommunityNotifications } from "@/components/community/community-notifications";
import { pricingOffers } from "@/features/pricing/offers";
import { useMemberPreferences } from "@/components/member-preferences-provider";
import {
  ElectricLogo,
  NavIconOverview,
  NavIconSkills,
  NavIconCatalog,
  NavIconMcp,
  NavIconCommunity,
  NavIconMyCommunity,
  NavIconProspection,
  NavIconBilling,
  NavIconPrivacy,
  NavIconHelp,
  ArrowRightIcon,
  BellIcon,
  CheckIcon,
  MoreVerticalIcon,
  GearIcon,
  PlayIcon,
  BlueWavesGraphic,
  CyanBarChartGraphic,
  VioletWaveGraphic,
  ChevronDownIcon,
  LogOutIcon,
  CreditCardIcon,
} from "@/components/electric-icons";
import { ElectricBannerGraphic } from "@/components/electric-banner-graphic";

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

type Section = "overview" | "skills" | "catalog" | "mcp" | "billing" | "subscription" | "privacy" | "help";

const navSections: { id: Section; label: string; icon: typeof NavIconOverview }[] = [
  { id: "overview", label: "Vue d’ensemble", icon: NavIconOverview },
  { id: "skills", label: "Mes skills", icon: NavIconSkills },
  { id: "catalog", label: "Catalogue", icon: NavIconCatalog },
  { id: "mcp", label: "Tutoriel Claude", icon: NavIconMcp },
];

const yourSpaceSections: { id: Section; label: string; icon: typeof NavIconBilling }[] = [
  { id: "billing", label: "Facturation", icon: NavIconBilling },
  { id: "privacy", label: "Données et confidentialité", icon: NavIconPrivacy },
  { id: "help", label: "Aide", icon: NavIconHelp },
];

const subscribeToLocation = () => () => {};
const getBrowserOrigin = () => window.location.origin;
const getServerOrigin = () => "";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseAccountData(payload: unknown): AccountData {
  if (
    !isRecord(payload) ||
    !isRecord(payload.user) ||
    typeof payload.user.id !== "string" ||
    typeof payload.user.email !== "string" ||
    !Array.isArray(payload.orders) ||
    !Array.isArray(payload.skills) ||
    !Array.isArray(payload.mcpKeys) ||
    !Array.isArray(payload.tickets)
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const browserOrigin = useSyncExternalStore(subscribeToLocation, getBrowserOrigin, getServerOrigin);
  const mcpUrl = browserOrigin ? `${browserOrigin}/api/mcp` : "";

  useEffect(() => {
    if (!profileMenuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileMenuOpen]);

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
    setMobileMenuOpen(false);
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
      window.setTimeout(() => setMcpUrlCopied(false), 2500);
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

  // Derived user details
  const userDisplayName = profile?.displayName || account?.user.email?.split("@")[0] || "Membre";
  const userInitials = profile?.displayName
    ? profile.displayName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : (account?.user.email || "HQ").slice(0, 2).toUpperCase();

  // Highlighted / Recent skills data logic
  const displaySkills = useMemo(() => {
    if (!account) return [];
    if (account.skills.length > 0) {
      return account.skills.slice(0, 6);
    }
    // Fallback featured skills when user has no purchases yet
    return [
      {
        entitlementId: "featured-1",
        productId: "prod-1",
        slug: "go-pro-mlm",
        memberSkillSlug: "go-pro-mlm",
        name: "MLM Go Pro Routine Coach",
        description: "Votre assistant pour une routine quotidienne structurée et efficace en MLM.",
        domain: "Productivité",
        grantedAt: new Date().toISOString(),
        version: "1.0.0",
        hasClaudeFile: true,
        hasChatGptFile: true,
        hasArchive: true,
        isDemo: true,
        tags: ["Productivité", "Business"],
        iconColor: "from-[#6557FF] to-[#B3A4FF]",
      },
      {
        entitlementId: "featured-2",
        productId: "prod-2",
        slug: "prospection-intelligente",
        memberSkillSlug: "prospection-intelligente",
        name: "Prospection intelligente",
        description: "Trouvez et contactez vos prospects avec des messages personnalisés par l'IA.",
        domain: "Vente",
        grantedAt: new Date().toISOString(),
        version: "1.2.0",
        hasClaudeFile: true,
        hasChatGptFile: true,
        hasArchive: true,
        isDemo: true,
        tags: ["Vente", "Marketing"],
        iconColor: "from-[#397BFF] to-[#00E5FF]",
      },
      {
        entitlementId: "featured-3",
        productId: "prod-3",
        slug: "assistant-contenu-ia",
        memberSkillSlug: "assistant-contenu-ia",
        name: "Assistant de contenu IA",
        description: "Créez du contenu de qualité en quelques clics avec l'assistance de l'IA.",
        domain: "Création",
        grantedAt: new Date().toISOString(),
        version: "1.1.0",
        hasClaudeFile: true,
        hasChatGptFile: true,
        hasArchive: true,
        isDemo: true,
        tags: ["Création", "Productivité"],
        iconColor: "from-[#6557FF] to-[#397BFF]",
      },
    ];
  }, [account]);

  const filteredSkills = displaySkills;

  return (
    <main className="app-shell-bare account-premium min-h-screen bg-[#F5F7FC] text-[#111827] font-[family-name:var(--font-instrument-sans),sans-serif] selection:bg-[#4F46E5] selection:text-white">
      {/* Layout Grid: Left Sidebar + Main Content */}
      <div className="min-h-screen lg:grid lg:grid-cols-[18rem_minmax(0,1fr)]">
        {/* ===================== SIDEBAR ===================== */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[#1E2B4C] bg-[#11182B] transition-transform duration-300 ease-in-out lg:static lg:w-auto lg:translate-x-0 ${
            mobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
          }`}
        >
          {/* Sidebar Top: Logo */}
          <div className="flex items-center justify-between border-b border-[#1E2B4C]/80 px-6 py-6">
            <Link href="/" className="group flex items-center transition">
              <ElectricLogo />
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg p-1.5 text-[#8F9CAE] hover:bg-white/[0.06] hover:text-white lg:hidden"
              aria-label="Fermer le menu"
            >
              ✕
            </button>
          </div>

          {/* Sidebar Navigation */}
          <div className="flex flex-1 flex-col justify-between overflow-y-auto px-4 py-6">
            <div className="space-y-6">
              {/* Primary Navigation */}
              <nav aria-label="Navigation principale" className="space-y-1.5">
                {navSections.map((item) => {
                  const Icon = item.icon;
                  const isActive = section === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => {
                        clearFeedback();
                        changeSection(item.id);
                      }}
                      className={`group flex min-h-[46px] w-full items-center gap-3.5 rounded-xl px-4 text-left text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? "bg-gradient-to-r from-[#397BFF] to-[#6557FF] text-white shadow-[0_8px_24px_rgba(57,123,255,0.35)] font-semibold"
                          : "text-[#8F9CAE] hover:bg-white/[0.04] hover:text-white hover:translate-x-1"
                      }`}
                    >
                      <Icon active={isActive} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}

                {/* External Community Links */}
                <Link
                  href="/community"
                  className="group flex min-h-[46px] w-full items-center gap-3.5 rounded-xl px-4 text-left text-sm font-medium text-[#8F9CAE] transition-all duration-200 hover:bg-white/[0.04] hover:text-white hover:translate-x-1"
                >
                  <NavIconCommunity active={false} />
                  <span>Communauté</span>
                </Link>

                <Link
                  href="/community/my"
                  className="group flex min-h-[46px] w-full items-center gap-3.5 rounded-xl px-4 text-left text-sm font-medium text-[#8F9CAE] transition-all duration-200 hover:bg-white/[0.04] hover:text-white hover:translate-x-1"
                >
                  <NavIconMyCommunity active={false} />
                  <span>Ma communauté</span>
                </Link>

                <Link
                  href="/member/prospection"
                  className="group flex min-h-[46px] w-full items-center gap-3.5 rounded-xl px-4 text-left text-sm font-medium text-[#8F9CAE] transition-all duration-200 hover:bg-white/[0.04] hover:text-white hover:translate-x-1"
                >
                  <NavIconProspection active={false} />
                  <span>SkillFlow Prospection</span>
                </Link>
              </nav>

              {/* Secondary Navigation: VOTRE ESPACE */}
              <div className="pt-2">
                <p className="px-4 pb-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#64748B]">
                  Votre espace
                </p>
                <nav aria-label="Votre espace" className="space-y-1.5">
                  {yourSpaceSections.map((item) => {
                    const Icon = item.icon;
                    const isActive = section === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => {
                          clearFeedback();
                          changeSection(item.id);
                        }}
                        className={`group flex min-h-[46px] w-full items-center gap-3.5 rounded-xl px-4 text-left text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? "bg-gradient-to-r from-[#397BFF] to-[#6557FF] text-white shadow-[0_8px_24px_rgba(57,123,255,0.35)] font-semibold"
                            : "text-[#8F9CAE] hover:bg-white/[0.04] hover:text-white hover:translate-x-1"
                        }`}
                      >
                        <Icon active={isActive} />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>

            {/* Sidebar Bottom: Promo Card ("Passez au niveau supérieur") */}
            <div className="relative mt-8 overflow-hidden rounded-2xl border border-[#202E50] bg-[#151F38] p-4 shadow-lg">
              {/* Subtle ambient glow arc in card corner */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-gradient-to-br from-[#6557FF]/30 to-[#397BFF]/20 blur-xl"
              />

              <div className="relative z-10">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#397BFF] to-[#6557FF] text-white shadow-[0_3px_12px_rgba(57,123,255,0.4)]">
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2.2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="white" stroke="none" />
                  </svg>
                </div>

                <h3 className="mt-3 text-sm font-bold text-white">Passez au niveau supérieur</h3>
                <p className="mt-1 text-xs leading-5 text-[#8F9CAE]">
                  Découvrez tous les avantages de votre abonnement
                </p>

                <button
                  type="button"
                  onClick={() => changeSection("subscription")}
                  className="mt-3.5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#397BFF] to-[#6557FF] px-3.5 py-2 text-xs font-semibold text-white shadow-[0_4px_14px_rgba(57,123,255,0.35)] transition duration-200 hover:brightness-110 active:scale-[0.98]"
                >
                  <span>Voir mon offre</span>
                  <ArrowRightIcon className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile backdrop */}
        {mobileMenuOpen && (
          <div
            aria-hidden="true"
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          />
        )}

        {/* ===================== MAIN CONTENT WRAPPER ===================== */}
        <div className="account-premium-content flex min-w-0 flex-col">
          {/* ===================== TOP HEADER ===================== */}
          <header className="account-dashboard-header sticky top-0 z-[100] isolate flex min-h-[80px] items-center justify-between gap-3 border-b border-[#E5EAF2] bg-white px-4 sm:gap-5 sm:px-8 lg:px-10">
            {/* Left: Mobile hamburger + Search input */}
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E5EAF2] bg-[#F7F9FC] text-[#78849A] transition hover:border-[#4361EE]/40 hover:text-[#4361EE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4361EE]/30 lg:hidden"
                aria-label="Ouvrir le menu"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>

              <Link href="/" aria-label="Skillsflow, accueil" className="site-logo account-mobile-logo lg:hidden">
                <ElectricLogo />
              </Link>

              {/*
                    placeholder="Rechercher un skill, une fonctionnalité..."
                    className="w-full min-w-0 bg-transparent text-sm text-[#172033] outline-none placeholder:text-[#78849A]"
                  />
                </div>
              </div>
              */}
            </div>

            {/* Right: Notifications + User Profile Pill */}
            <div className="flex shrink-0 items-center gap-2 sm:gap-4">
              {/* Notification Bell */}
              <div className="relative">
                {account ? (
                  <CommunityNotifications userId={account.user.id} variant="light" />
                ) : (
                  <button
                    type="button"
                    aria-label="Notifications"
                    className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[#E5EAF2] bg-white text-[#78849A] transition hover:border-[#4361EE]/40 hover:bg-[#F7F9FC] hover:text-[#4361EE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4361EE]/30"
                  >
                    <BellIcon className="h-5 w-5" />
                  </button>
                )}
              </div>

              {/* User Profile Pill & Dropdown */}
              <div ref={profileMenuRef} className="relative z-[110]">
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((prev) => !prev)}
                  aria-expanded={profileMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Menu du profil utilisateur"
                  className="group flex cursor-pointer items-center gap-2 rounded-full border border-transparent p-1 pr-1.5 transition-all duration-200 hover:border-[#E5EAF2] hover:bg-[#F7F9FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4361EE]/30 sm:gap-3 sm:pr-3"
                >
                  {/* Avatar circle with status dot */}
                  <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#C9D2FF] bg-gradient-to-br from-[#4361EE] to-[#6C63FF] text-sm font-bold text-white shadow-[0_4px_10px_rgba(67,97,238,0.2)] transition-transform group-hover:scale-105">
                    {profile?.avatarUrl ? (
                      <Image
                        src={profile.avatarUrl}
                        alt=""
                        width={40}
                        height={40}
                        unoptimized
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      userInitials
                    )}
                  </div>

                  {/* Name and Premium status badge */}
                  <div className="text-left">
                    <p className="max-w-36 truncate text-sm font-bold leading-tight text-[#172033]">
                      {userDisplayName}
                    </p>
                    <p className="flex items-center gap-1 text-[11px] font-semibold text-[#6C63FF]">
                      <span>👑</span>
                      <span>Membre Premium</span>
                    </p>
                  </div>

                  {/* Animated Chevron */}
                  <ChevronDownIcon
                    className={`h-4 w-4 text-[#78849A] transition-transform duration-200 ${
                      profileMenuOpen ? "rotate-180 text-[#4361EE]" : "group-hover:text-[#4361EE]"
                    }`}
                  />
                </button>

                {/* Dropdown Menu Card */}
                {profileMenuOpen && (
                  <nav
                    aria-label="Menu du compte utilisateur"
                    className="account-profile-menu pointer-events-auto absolute right-0 top-full z-[120] mt-3 max-h-[calc(100vh-6rem)] w-[min(28rem,calc(100vw-1.5rem))] overflow-y-auto rounded-3xl border border-[#2A3C70] bg-[#0D1326] p-3 shadow-[0_24px_70px_rgba(4,10,30,0.45)]"
                  >
                    {/* User Header Info Card */}
                    <div className="mb-3 rounded-2xl border border-[#263A72] bg-[#162554] p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#7AA7FF] bg-gradient-to-br from-[#3D8BFF] to-[#5948F5] text-base font-bold text-white shadow-[0_0_22px_rgba(67,97,238,.35)]">
                          {profile?.avatarUrl ? (
                            <Image
                              src={profile.avatarUrl}
                              alt=""
                              width={44}
                              height={44}
                              unoptimized
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            userInitials
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-lg font-bold text-white">{userDisplayName}</p>
                          <p className="truncate text-sm text-[#AFC2F5]">{account?.user.email || ""}</p>
                          <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-[#596DFF] bg-[#3844A9]/40 px-3 py-1 text-xs font-bold text-[#BFC8FF]">
                            <span>👑</span>
                            <span>Premium</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Nav Actions */}
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          changeSection("overview");
                          setProfileMenuOpen(false);
                        }}
                        className="group flex w-full items-center gap-4 rounded-2xl px-3.5 py-3.5 text-left text-sm font-medium text-[#D8E2FF] transition-all hover:bg-[#1A2B5E] hover:text-white"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#397BFF]/15 text-[#397BFF] transition-colors group-hover:bg-[#397BFF] group-hover:text-white">
                          <NavIconOverview active />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold leading-tight text-white">Mon espace client</p>
                          <p className="text-[11px] text-[#8F9CAE]">Tableau de bord & vue globale</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          changeSection("skills");
                          setProfileMenuOpen(false);
                        }}
                        className="group flex w-full items-center gap-4 rounded-2xl px-3.5 py-3.5 text-left text-sm font-medium text-[#D8E2FF] transition-all hover:bg-[#1A2B5E] hover:text-white"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#00E5FF]/15 text-[#00E5FF] transition-colors group-hover:bg-[#00E5FF] group-hover:text-slate-950">
                          <NavIconSkills active />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold leading-tight text-white">Mes skills & IA</p>
                          <p className="text-[11px] text-[#8F9CAE]">Accéder à vos outils actifs</p>
                        </div>
                      </button>

                      <Link
                        href="/member/settings"
                        onClick={() => setProfileMenuOpen(false)}
                        className="group flex w-full items-center gap-4 rounded-2xl px-3.5 py-3.5 text-left text-sm font-medium text-[#D8E2FF] transition-all hover:bg-[#1A2B5E] hover:text-white"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#B3A4FF]/15 text-[#B3A4FF] transition-colors group-hover:bg-[#B3A4FF] group-hover:text-[#0B1020]">
                          <GearIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold leading-tight text-white">Profil et réglages</p>
                          <p className="text-[11px] text-[#8F9CAE]">Photo, clés MCP & sécurité</p>
                        </div>
                      </Link>

                      <button
                        type="button"
                        onClick={() => {
                          changeSection("billing");
                          setProfileMenuOpen(false);
                        }}
                        className="group flex w-full items-center gap-4 rounded-2xl px-3.5 py-3.5 text-left text-sm font-medium text-[#D8E2FF] transition-all hover:bg-[#1A2B5E] hover:text-white"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#6557FF]/15 text-[#6557FF] transition-colors group-hover:bg-[#6557FF] group-hover:text-white">
                          <CreditCardIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold leading-tight text-white">Commandes & Factures</p>
                          <p className="text-[11px] text-[#8F9CAE]">Historique et reçus</p>
                        </div>
                      </button>
                    </div>

                    {/* Divider */}
                    <div className="my-1.5 h-px bg-gradient-to-r from-transparent via-[#233558] to-transparent" />

                    {/* Sign Out Action */}
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        void signOut();
                      }}
                      className="group flex w-full items-center gap-4 rounded-2xl px-3.5 py-3.5 text-left text-sm font-medium text-rose-300 transition-all hover:bg-rose-500/15 hover:text-rose-200"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/15 text-rose-400 transition-colors group-hover:bg-rose-500 group-hover:text-white">
                        <LogOutIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-tight text-rose-200">Se déconnecter</p>
                        <p className="text-[11px] text-rose-300/70">Fermer votre session</p>
                      </div>
                    </button>
                  </nav>
                )}
              </div>
            </div>
          </header>

          {/* ===================== MAIN BODY VIEW ===================== */}
          <div className="relative z-10 flex-1 px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
            {/* Notifications / Alerts */}
            {(error || notice) && (
              <div
                className={`mb-6 rounded-2xl border p-4 text-sm font-medium ${
                  error
                    ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
                    : "border-cyan-400/30 bg-cyan-500/10 text-cyan-200"
                }`}
                role={error ? "alert" : "status"}
              >
                {error || notice}
              </div>
            )}

            {loading ? (
              <div className="flex min-h-[300px] items-center justify-center text-sm text-[#8F9CAE]">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#397BFF] border-t-transparent" />
                  <span>Chargement de votre espace…</span>
                </div>
              </div>
            ) : !account ? (
              <section className="rounded-3xl border border-[#202E50] bg-[#151F38] p-8 text-center" role="alert">
                <h2 className="text-xl font-bold text-white">Votre espace est momentanément indisponible</h2>
                <p className="mt-2 text-sm text-[#8F9CAE]">{error || "Réessayez dans quelques instants."}</p>
              </section>
            ) : (
              <div className="space-y-8" key={section}>
                {/* ===================== VIEW: OVERVIEW ===================== */}
                {section === "overview" && (
                  <div className="space-y-8">
                    {/* 1. Header Section: Big Title + Floating Decorative Graphics */}
                    <div className="relative flex flex-col justify-between gap-6 pb-2 lg:flex-row lg:items-center">
                      <div className="max-w-2xl">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#4F46E5]">Espace membre</p>
                        <h1 id="account-title" className="mt-2 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                          Votre espace Skill
                          <span className="bg-gradient-to-r from-[#00E5FF] via-[#397BFF] to-[#6557FF] bg-clip-text text-transparent">
                            Flow
                          </span>
                        </h1>
                        <p className="mt-3 text-base leading-relaxed text-[#8F9CAE] sm:text-lg">
                          Retrouvez vos skills IA, gérez vos achats et accédez à votre assistant personnel.
                        </p>
                      </div>

                      {/* Right Decorative Glass Elements matching the reference image */}
                      <div aria-hidden="true" className="account-hero-decoration pointer-events-none relative z-0 hidden select-none lg:block">
                        <div className="pointer-events-none relative h-24 w-60">
                          {/* Floating Glass Tile 1 (Blue) */}
                          <div className="pointer-events-none absolute right-12 top-2 h-14 w-24 rotate-[10deg] rounded-2xl border border-white/20 bg-gradient-to-br from-[#397BFF]/35 to-[#6557FF]/20 backdrop-blur-md shadow-[0_8px_24px_rgba(57,123,255,0.25)] animate-electric-float" />
                          {/* Floating Glass Tile 2 (Violet) */}
                          <div
                            className="pointer-events-none absolute right-2 top-5 h-14 w-20 rotate-[-6deg] rounded-2xl border border-white/25 bg-gradient-to-br from-[#6557FF]/35 to-[#B3A4FF]/20 backdrop-blur-md shadow-[0_8px_24px_rgba(101,87,255,0.25)] animate-electric-float"
                            style={{ animationDelay: "1.2s" }}
                          />
                          {/* Sparkle and Lavender Text */}
                          <div className="pointer-events-none absolute right-4 top-2 text-right">
                            <span className="text-lg text-[#B3A4FF]">✦</span>
                            <p className="mt-0.5 text-[11px] font-bold text-[#B3A4FF]">Plus de skills.</p>
                            <p className="text-[11px] font-bold text-[#B3A4FF]">Plus de possibilités.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 2. Three Statistics Cards: Blue, Cyan, Violet */}
                    <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3">
                      {/* Card 1: Skills accessibles (Blue) */}
                      <article
                        onClick={() => changeSection("skills")}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); changeSection("skills"); } }}
                        className="account-stat-card group relative cursor-pointer overflow-hidden rounded-2xl border border-[#202E50] bg-[#151F38] p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-[#397BFF]/50 hover:shadow-[0_12px_36px_rgba(57,123,255,0.2)]"
                      >
                        <BlueWavesGraphic />
                        <div className="relative z-10 flex items-start justify-between">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#397BFF]/20 text-[#397BFF] shadow-[0_0_15px_rgba(57,123,255,0.3)]">
                            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2">
                              <polygon points="12 2 2 7 12 12 22 7 12 2" />
                              <polyline points="2 17 12 22 22 17" />
                              <polyline points="2 12 12 17 22 12" />
                            </svg>
                          </div>
                          <p className="text-sm font-semibold text-white">Skills accessibles</p>
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-[#8F9CAE] transition-all group-hover:bg-[#397BFF] group-hover:text-white group-hover:translate-x-1">
                            <ArrowRightIcon className="h-4 w-4" />
                          </div>
                        </div>

                        <div className="relative z-10 mt-6">
                          <p className="text-4xl font-black tracking-tight text-white">
                            {String(account.skills.length).padStart(2, "0")}
                          </p>
                          <p className="mt-1 text-sm text-[#8F9CAE]">Vos accès actifs</p>
                        </div>
                      </article>

                      {/* Card 2: Commandes (Cyan) */}
                      <article
                        onClick={() => changeSection("billing")}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); changeSection("billing"); } }}
                        className="account-stat-card group relative cursor-pointer overflow-hidden rounded-2xl border border-[#202E50] bg-[#151F38] p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-[#00E5FF]/50 hover:shadow-[0_12px_36px_rgba(0,229,255,0.2)]"
                      >
                        <CyanBarChartGraphic />
                        <div className="relative z-10 flex items-start justify-between">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#00E5FF]/20 text-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.3)]">
                            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2">
                              <circle cx="9" cy="21" r="1" />
                              <circle cx="20" cy="21" r="1" />
                              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                            </svg>
                          </div>
                          <p className="text-sm font-semibold text-white">Commandes</p>
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-[#8F9CAE] transition-all group-hover:bg-[#00E5FF] group-hover:text-slate-950 group-hover:translate-x-1">
                            <ArrowRightIcon className="h-4 w-4" />
                          </div>
                        </div>

                        <div className="relative z-10 mt-6">
                          <p className="text-4xl font-black tracking-tight text-white">
                            {String(account.orders.length).padStart(2, "0")}
                          </p>
                          <p className="mt-1 text-sm text-[#8F9CAE]">Historique de vos achats</p>
                        </div>
                      </article>

                      {/* Card 3: Tutoriel Claude (Violet) */}
                      <article
                        onClick={() => changeSection("mcp")}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); changeSection("mcp"); } }}
                        className="account-stat-card group relative cursor-pointer overflow-hidden rounded-2xl border border-[#202E50] bg-[#151F38] p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-[#6557FF]/50 hover:shadow-[0_12px_36px_rgba(101,87,255,0.2)]"
                      >
                        <VioletWaveGraphic />
                        <div className="relative z-10 flex items-start justify-between">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#6557FF]/20 text-[#B3A4FF] shadow-[0_0_15px_rgba(101,87,255,0.3)]">
                            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2">
                              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                            </svg>
                          </div>
                          <p className="text-sm font-semibold text-white">Tutoriel Claude</p>
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-[#8F9CAE] transition-all group-hover:bg-[#6557FF] group-hover:text-white group-hover:translate-x-1">
                            <ArrowRightIcon className="h-4 w-4" />
                          </div>
                        </div>

                        <div className="relative z-10 mt-6">
                          <p className="text-3xl font-black tracking-tight text-[#00F0A0]">
                            Disponible
                          </p>
                          <p className="mt-1 text-sm text-[#8F9CAE]">Connectez votre agent IA</p>
                        </div>
                      </article>
                    </div>

                    {/* 3. Welcome Hero Banner with 3D Platform Illustration & Checklist */}
                    <section className="relative overflow-hidden rounded-3xl border border-[#202E50] bg-[#151F38] p-6 shadow-2xl transition duration-300 hover:border-[#397BFF]/30 sm:p-8 lg:p-10">
                      {/* Ambient electric blue aura */}
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-gradient-to-br from-[#397BFF]/20 to-[#6557FF]/15 blur-3xl"
                      />

                      <div className="relative z-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                        {/* Left column: Text & CTAs */}
                        <div>
                          <div className="inline-flex items-center gap-2 rounded-full border border-[#397BFF]/35 bg-[#397BFF]/15 px-3.5 py-1 text-xs font-bold text-[#8FB5FF]">
                            <span>⚡</span>
                            <span>Bienvenue</span>
                          </div>

                          <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                            Votre espace{" "}
                            <span className="bg-gradient-to-r from-[#397BFF] to-[#6557FF] bg-clip-text text-transparent">
                              IA est prêt
                            </span>
                          </h2>

                          <p className="mt-3 max-w-xl text-base leading-relaxed text-[#8F9CAE]">
                            Accédez à vos skills, configurez Claude et explorez tout ce que SkillFlow peut vous offrir pour booster votre productivité.
                          </p>

                          {/* 3 Action Buttons */}
                          <div className="mt-7 flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={() => changeSection("catalog")}
                              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#397BFF] to-[#6557FF] px-6 py-3 text-sm font-bold text-white shadow-[0_6px_22px_rgba(57,123,255,0.4)] transition hover:brightness-110 active:scale-[0.98]"
                            >
                              <span>Explorer le catalogue</span>
                              <ArrowRightIcon className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => changeSection("mcp")}
                              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#25365E] bg-[#11182B]/80 px-5 py-3 text-sm font-semibold text-white transition hover:border-[#397BFF]/50 hover:bg-[#1E2945]"
                            >
                              <GearIcon className="h-4 w-4 text-[#8F9CAE]" />
                              <span>Configurer Claude</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => changeSection("skills")}
                              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#25365E] bg-transparent px-5 py-3 text-sm font-semibold text-[#8F9CAE] transition hover:border-white/20 hover:text-white"
                            >
                              <PlayIcon className="h-4 w-4 text-[#8F9CAE]" />
                              <span>Découvrir SkillFlow</span>
                            </button>
                          </div>
                        </div>

                        {/* Right column: 3D Platform Graphic + Feature Checklist */}
                        <div className="flex flex-col items-center justify-center gap-6 sm:flex-row lg:justify-end">
                          <ElectricBannerGraphic className="w-full max-w-[280px]" />

                          {/* Checklist matching reference */}
                          <ul className="space-y-3.5 text-sm font-medium text-slate-200">
                            <li className="flex items-center gap-2.5">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#00E5FF]/20 text-[#00E5FF]">
                                <CheckIcon className="h-3.5 w-3.5" />
                              </span>
                              <span>Skills IA installables</span>
                            </li>
                            <li className="flex items-center gap-2.5">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#00E5FF]/20 text-[#00E5FF]">
                                <CheckIcon className="h-3.5 w-3.5" />
                              </span>
                              <span>Intégration MCP</span>
                            </li>
                            <li className="flex items-center gap-2.5">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#00E5FF]/20 text-[#00E5FF]">
                                <CheckIcon className="h-3.5 w-3.5" />
                              </span>
                              <span>Automatisation</span>
                            </li>
                            <li className="flex items-center gap-2.5">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#00E5FF]/20 text-[#00E5FF]">
                                <CheckIcon className="h-3.5 w-3.5" />
                              </span>
                              <span>Support dédié</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </section>

                    {/* 4. "Vos skills récents" Section with Electric Cards */}
                    <section aria-labelledby="recent-skills-heading" className="space-y-5">
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <h2 id="recent-skills-heading" className="text-2xl font-bold tracking-tight text-white">
                            Vos skills récents
                          </h2>
                          <p className="mt-1 text-sm text-[#8F9CAE]">
                            Accédez rapidement à vos skills installés et gérez-les facilement.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => changeSection("skills")}
                          className="group inline-flex items-center gap-1.5 text-sm font-semibold text-[#8FB5FF] transition hover:text-white"
                        >
                          <span>Voir tout</span>
                          <ArrowRightIcon className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                        </button>
                      </div>

                      {/* Skills Cards Grid */}
                      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                        {filteredSkills.map((skill, index) => {
                          const iconGradients = [
                            "from-[#6557FF] to-[#B3A4FF]",
                            "from-[#397BFF] to-[#00E5FF]",
                            "from-[#6557FF] to-[#397BFF]",
                          ];
                          const grad = iconGradients[index % iconGradients.length];

                          return (
                            <article
                              key={skill.entitlementId || skill.slug}
                              className="group flex flex-col justify-between rounded-2xl border border-[#202E50] bg-[#151F38] p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-[#397BFF]/50 hover:shadow-[0_12px_36px_rgba(57,123,255,0.2)]"
                            >
                              <div>
                                {/* Card Top: Icon + Title + Status Pill + More Menu */}
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${grad} text-white shadow-md`}
                                    >
                                      {index % 3 === 0 ? (
                                        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2">
                                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                          <circle cx="12" cy="7" r="4" />
                                        </svg>
                                      ) : index % 3 === 1 ? (
                                        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2">
                                          <circle cx="12" cy="12" r="10" />
                                          <circle cx="12" cy="12" r="6" />
                                          <circle cx="12" cy="12" r="2" />
                                        </svg>
                                      ) : (
                                        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2">
                                          <path d="M12 19l7-7 3 3-7 7-3-3z" />
                                          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                                          <path d="M2 2l7.586 7.586" />
                                          <circle cx="11" cy="11" r="2" />
                                        </svg>
                                      )}
                                    </div>

                                    <div>
                                      <h3 className="text-base font-bold text-white group-hover:text-[#8FB5FF] transition">
                                        {skill.name}
                                      </h3>
                                      <p className="text-xs text-[#8F9CAE]">
                                        Version {skill.version || "1.0.0"} • MCP
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span className="rounded-full border border-[#00F0A0]/30 bg-[#00F0A0]/15 px-2.5 py-0.5 text-xs font-semibold text-[#00F0A0]">
                                      Actif
                                    </span>
                                    <button
                                      type="button"
                                      aria-label="Options"
                                      className="rounded-lg p-1 text-[#8F9CAE] hover:bg-white/[0.06] hover:text-white"
                                    >
                                      <MoreVerticalIcon className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>

                                {/* Description */}
                                <p className="mt-4 min-h-[48px] text-sm leading-6 text-[#8F9CAE]">
                                  {skill.description || "Assistant IA configuré et connecté à votre compte SkillFlow."}
                                </p>
                              </div>

                              {/* Card Bottom: Tags + Button */}
                              <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#202E50]/70 pt-4">
                                <div className="flex flex-wrap gap-2">
                                  <span className="rounded-lg border border-[#202E50] bg-[#10192D] px-2.5 py-1 text-xs font-medium text-[#8F9CAE]">
                                    {skill.domain || "Productivité"}
                                  </span>
                                  <span className="rounded-lg border border-[#202E50] bg-[#10192D] px-2.5 py-1 text-xs font-medium text-[#8F9CAE]">
                                    MCP
                                  </span>
                                </div>

                                <Link
                                  href={
                                    skill.memberSkillSlug
                                      ? `/member/skills/${skill.memberSkillSlug}/setup`
                                      : skill.slug
                                      ? `/member/skills/${skill.slug}`
                                      : "/member/skills"
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#397BFF] px-4 py-2 text-xs font-bold text-white shadow-md transition hover:bg-[#2F6DF0] active:scale-95"
                                >
                                  <span>Ouvrir</span>
                                  <ArrowRightIcon className="h-3 w-3" />
                                </Link>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  </div>
                )}

                {/* ===================== VIEW: MES SKILLS ===================== */}
                {section === "skills" && (
                  <div className="space-y-6">
                    <header className="rounded-3xl border border-[#202E50] bg-[#151F38] p-6 sm:p-8">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#397BFF]">Vos compétences</p>
                      <h2 className="mt-2 text-3xl font-black text-white">Mes skills</h2>
                      <p className="mt-2 text-sm text-[#8F9CAE]">
                        Accédez à vos compétences débloquées, téléchargez les définitions et configurez leur intégration Claude.
                      </p>
                    </header>

                    {account.skills.length === 0 ? (
                      <div className="rounded-3xl border border-[#202E50] bg-[#151F38] p-8 text-center sm:p-12">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#397BFF]/20 text-[#397BFF]">
                          <NavIconSkills active />
                        </div>
                        <h3 className="mt-4 text-xl font-bold text-white">Aucun skill actif pour le moment</h3>
                        <p className="mx-auto mt-2 max-w-md text-sm text-[#8F9CAE]">
                          Vos accès apparaîtront ici après confirmation d’un achat dans le catalogue.
                        </p>
                        <button
                          type="button"
                          onClick={() => changeSection("catalog")}
                          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#397BFF] to-[#6557FF] px-6 py-3 text-sm font-bold text-white transition hover:brightness-110"
                        >
                          <span>Voir le catalogue</span>
                          <ArrowRightIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                        {account.skills.map((skill) => (
                          <article
                            key={skill.entitlementId}
                            className="flex flex-col justify-between rounded-2xl border border-[#202E50] bg-[#151F38] p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-[#397BFF]/50"
                          >
                            <div>
                              <div className="flex items-start justify-between gap-3">
                                <h3 className="text-lg font-bold text-white">{skill.name}</h3>
                                <span className="rounded-full border border-[#00F0A0]/30 bg-[#00F0A0]/15 px-2.5 py-0.5 text-xs font-semibold text-[#00F0A0]">
                                  Actif
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-[#8F9CAE]">
                                Version {skill.version || "1.0.0"} • {skill.domain}
                              </p>
                              <p className="mt-4 text-sm leading-6 text-[#8F9CAE]">
                                {skill.description || "Skill prêt à l'emploi avec votre agent."}
                              </p>
                            </div>

                            <div className="mt-6 flex flex-wrap gap-2 border-t border-[#202E50] pt-4">
                              <Link
                                href={`/member/skills/${skill.memberSkillSlug || skill.slug || skill.productId}/setup`}
                                className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#397BFF] px-4 text-xs font-bold text-white transition hover:bg-[#2F6DF0]"
                              >
                                Configurer
                              </Link>
                              <button
                                type="button"
                                onClick={() => changeSection("mcp")}
                                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#202E50] bg-white/[0.04] px-4 text-xs font-semibold text-[#8FB5FF] transition hover:bg-white/[0.08]"
                              >
                                Tutoriel Claude
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ===================== VIEW: CATALOGUE ===================== */}
                {section === "catalog" && <AccountCatalog />}

                {/* ===================== VIEW: MCP (TUTORIEL CLAUDE) ===================== */}
                {section === "mcp" && (
                  <div className="space-y-6">
                    <header className="rounded-3xl border border-[#202E50] bg-[#151F38] p-6 sm:p-8">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#397BFF]">Intégration MCP</p>
                      <h2 className="mt-2 text-3xl font-black text-white">Tutoriel de connexion à Claude</h2>
                      <p className="mt-2 text-sm text-[#8F9CAE]">
                        Connectez vos skills SkillFlow à Claude Desktop ou Claude Web via le protocole MCP en quelques étapes.
                      </p>
                    </header>

                    {/* API Key Box */}
                    <section className="rounded-2xl border border-[#202E50] bg-[#151F38] p-6">
                      <h3 className="text-lg font-bold text-white">Clé de connexion MCP</h3>
                      <p className="mt-1 text-sm text-[#8F9CAE]">
                        Une clé est nécessaire pour accéder à vos skills depuis Claude. Elle est affichée une seule fois à sa création.
                      </p>

                      {newMcpKey && (
                        <div className="mt-4 rounded-xl border border-[#00F0A0]/30 bg-[#00F0A0]/10 p-4">
                          <label htmlFor="new-mcp-key" className="block text-xs font-bold uppercase tracking-wider text-[#00F0A0]">
                            Copiez cette clé dans Claude (elle ne sera plus visible après) :
                          </label>
                          <input
                            id="new-mcp-key"
                            readOnly
                            value={newMcpKey}
                            onFocus={(event) => event.currentTarget.select()}
                            className="mt-2 w-full rounded-lg border border-[#202E50] bg-[#0B1020] px-3.5 py-2 font-mono text-sm text-white outline-none"
                            autoComplete="off"
                          />
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              className="rounded-lg bg-[#397BFF] px-4 py-2 text-xs font-bold text-white hover:bg-[#2F6DF0]"
                              onClick={() =>
                                void navigator.clipboard.writeText(newMcpKey).then(
                                  () => setNotice("Clé copiée dans le presse-papier."),
                                  () => setError("Copie impossible. Sélectionnez la clé et copiez-la manuellement.")
                                )
                              }
                            >
                              Copier la clé
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewMcpKey("")}
                              className="rounded-lg px-3 py-2 text-xs font-semibold text-[#8F9CAE] hover:text-white"
                            >
                              Masquer
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => void createMcpKey()}
                          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-[#397BFF] to-[#6557FF] px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:brightness-110 disabled:opacity-60"
                        >
                          {account.mcpKeys.some((k) => k.status === "active") ? "Remplacer ma clé MCP" : "Créer ma clé MCP"}
                        </button>

                        {account.mcpKeys.some((k) => k.status === "active") && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => void revokeMcpKey()}
                            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-rose-500/40 bg-rose-500/10 px-5 py-2.5 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-60"
                          >
                            Révoquer ma clé
                          </button>
                        )}
                      </div>
                    </section>

                    {/* Step by step */}
                    <div className="rounded-2xl border border-[#202E50] bg-[#151F38] p-6 sm:p-8">
                      <h3 className="text-xl font-bold text-white">Étapes de configuration</h3>
                      <ol className="mt-6 space-y-6">
                        <li className="flex gap-4">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#397BFF] text-sm font-bold text-white shadow-md">
                            1
                          </span>
                          <div className="flex-1">
                            <h4 className="font-bold text-white">Ouvrez les connecteurs Claude</h4>
                            <p className="mt-1 text-sm text-[#8F9CAE]">
                              Rendez-vous dans les paramètres de votre compte Claude pour ajouter une extension MCP.
                            </p>
                            <a
                              href="https://claude.ai/settings/connectors"
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#8FB5FF] underline underline-offset-4 hover:text-white"
                            >
                              <span>Ouvrir les paramètres Claude</span>
                              <span>↗</span>
                            </a>
                          </div>
                        </li>

                        <li className="flex gap-4">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#397BFF] text-sm font-bold text-white shadow-md">
                            2
                          </span>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-white">Ajoutez le serveur SkillFlow</h4>
                            <p className="mt-1 text-sm text-[#8F9CAE]">
                              Choisissez « Ajouter un connecteur personnalisé », puis renseignez le nom et l’URL ci-dessous :
                            </p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-[10rem_1fr]">
                              <input
                                aria-label="Nom du connecteur"
                                readOnly
                                value="SkillFlow"
                                className="rounded-xl border border-[#202E50] bg-[#0B1020] px-3.5 py-2.5 text-sm text-white"
                              />
                              <div className="flex flex-col gap-2 sm:flex-row">
                                <input
                                  aria-label="Adresse du connecteur"
                                  readOnly
                                  value={mcpUrl}
                                  placeholder="Chargement…"
                                  className="w-full rounded-xl border border-[#202E50] bg-[#0B1020] px-3.5 py-2.5 font-mono text-xs text-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => void copyMcpUrl()}
                                  disabled={!mcpUrl}
                                  className="shrink-0 rounded-xl bg-[#397BFF] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#2F6DF0] disabled:opacity-50"
                                >
                                  {mcpUrlCopied ? "Copiée !" : "Copier l’adresse"}
                                </button>
                              </div>
                            </div>
                          </div>
                        </li>

                        <li className="flex gap-4">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#397BFF] text-sm font-bold text-white shadow-md">
                            3
                          </span>
                          <div className="flex-1">
                            <h4 className="font-bold text-white">Activez SkillFlow dans vos échanges</h4>
                            <p className="mt-1 text-sm text-[#8F9CAE]">
                              Dans toute conversation Claude, ouvrez « Recherche et outils », activez SkillFlow et demandez-lui d’utiliser vos compétences actives.
                            </p>
                          </div>
                        </li>
                      </ol>
                    </div>
                  </div>
                )}

                {/* ===================== VIEW: BILLING (FACTURATION) ===================== */}
                {section === "billing" && (
                  <div className="space-y-6">
                    <header className="rounded-3xl border border-[#202E50] bg-[#151F38] p-6 sm:p-8">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#397BFF]">Historique</p>
                      <h2 className="mt-2 text-3xl font-black text-white">Facturation</h2>
                      <p className="mt-2 text-sm text-[#8F9CAE]">
                        Consultez le statut et le montant de chaque commande passée sur SkillFlow.
                      </p>
                    </header>

                    {account.orders.length === 0 ? (
                      <div className="rounded-3xl border border-[#202E50] bg-[#151F38] p-8 text-center sm:p-12">
                        <h3 className="text-xl font-bold text-white">Aucune commande pour le moment</h3>
                        <p className="mt-2 text-sm text-[#8F9CAE]">Vos achats confirmés apparaîtront ici.</p>
                        <button
                          type="button"
                          onClick={() => changeSection("catalog")}
                          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#397BFF] to-[#6557FF] px-6 py-3 text-sm font-bold text-white"
                        >
                          <span>Voir le catalogue</span>
                          <ArrowRightIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {account.orders.map((order) => (
                          <div
                            key={order.id}
                            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#202E50] bg-[#151F38] p-6 shadow-md"
                          >
                            <div>
                              <h3 className="text-lg font-bold text-white">{order.products?.name ?? "SkillFlow Pack"}</h3>
                              <p className="mt-1 text-xs text-[#8F9CAE]">
                                Commande du {new Date(order.created_at).toLocaleDateString("fr-FR")} • Référence {order.id.slice(0, 8)}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-right">
                              <div>
                                <p className="text-base font-black text-white">€{Number(order.total).toFixed(2)}</p>
                                <p className="text-xs text-[#8F9CAE]">
                                  {new Intl.NumberFormat("fr-FR").format(order.total_xof ?? 0)} XOF
                                </p>
                              </div>

                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                  order.payment_status === "paid"
                                    ? "border border-[#00F0A0]/30 bg-[#00F0A0]/15 text-[#00F0A0]"
                                    : order.payment_status === "failed"
                                    ? "border border-rose-500/30 bg-rose-500/15 text-rose-300"
                                    : "border border-amber-500/30 bg-amber-500/15 text-amber-300"
                                }`}
                              >
                                {statusLabel(order.payment_status)}
                              </span>

                              {order.payment_status === "paid" && (
                                <button
                                  type="button"
                                  disabled={pending}
                                  onClick={() => void downloadOrderReceipt(order.id)}
                                  className="rounded-xl border border-[#202E50] bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.08]"
                                >
                                  {pending ? "Préparation…" : "Reçu PDF"}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ===================== VIEW: SUBSCRIPTION (ABONNEMENT) ===================== */}
                {section === "subscription" && <SubscriptionOffers />}

                {/* ===================== VIEW: PRIVACY (DONNÉES ET CONFIDENTIALITÉ) ===================== */}
                {section === "privacy" && (
                  <div className="space-y-6">
                    <header className="rounded-3xl border border-[#202E50] bg-[#151F38] p-6 sm:p-8">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#397BFF]">Confidentialité</p>
                      <h2 className="mt-2 text-3xl font-black text-white">Données et confidentialité</h2>
                      <p className="mt-2 text-sm text-[#8F9CAE]">
                        Contrôlez et exportez vos données personnelles conformément aux réglementations de protection des données.
                      </p>
                    </header>

                    {/* Export Card */}
                    <section className="rounded-2xl border border-[#202E50] bg-[#151F38] p-6 sm:p-8">
                      <h3 className="text-lg font-bold text-white">Export de vos données</h3>
                      <p className="mt-1 text-sm text-[#8F9CAE]">
                        Téléchargez une archive JSON complète contenant vos informations de compte, commandes, accès et clés.
                      </p>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => void exportData()}
                        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-[#397BFF] to-[#6557FF] px-6 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
                      >
                        {pending ? "Préparation…" : "Exporter mes données"}
                      </button>
                    </section>

                    {/* Delete Account */}
                    <section className="rounded-2xl border border-rose-500/30 bg-[#1A1422] p-6 sm:p-8">
                      <h3 className="text-lg font-bold text-rose-300">Supprimer mon compte</h3>
                      <p className="mt-1 text-sm text-[#A5B4CB]">
                        Cette action est définitive. Elle supprimera vos commandes, accès aux skills, configurations et demandes d’aide.
                      </p>

                      {!showDeleteForm ? (
                        <button
                          type="button"
                          onClick={() => setShowDeleteForm(true)}
                          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-rose-500/40 bg-rose-500/10 px-5 py-2.5 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/20"
                        >
                          Commencer la suppression
                        </button>
                      ) : (
                        <form onSubmit={(e) => void deleteAccount(e)} className="mt-6 max-w-lg space-y-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-rose-300">
                            Pour confirmer, saisissez SUPPRIMER et votre adresse e-mail :
                          </p>
                          <div>
                            <label htmlFor="delete-word" className="mb-1 block text-xs font-semibold text-slate-300">
                              Confirmation
                            </label>
                            <input
                              id="delete-word"
                              value={deleteWord}
                              onChange={(e) => setDeleteWord(e.target.value)}
                              autoComplete="off"
                              placeholder="SUPPRIMER"
                              className="w-full rounded-xl border border-rose-500/30 bg-[#0B1020] px-3.5 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-rose-500"
                            />
                          </div>
                          <div>
                            <label htmlFor="delete-email" className="mb-1 block text-xs font-semibold text-slate-300">
                              Adresse e-mail du compte
                            </label>
                            <input
                              id="delete-email"
                              type="email"
                              value={deleteEmail}
                              onChange={(e) => setDeleteEmail(e.target.value)}
                              autoComplete="email"
                              className="w-full rounded-xl border border-rose-500/30 bg-[#0B1020] px-3.5 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-rose-500"
                            />
                          </div>

                          <div className="flex gap-3 pt-2">
                            <button
                              type="submit"
                              disabled={
                                pending ||
                                deleteWord !== "SUPPRIMER" ||
                                deleteEmail.trim().toLowerCase() !== account.user.email.toLowerCase()
                              }
                              className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-rose-500 disabled:opacity-40"
                            >
                              {pending ? "Suppression…" : "Confirmer la suppression"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowDeleteForm(false);
                                setDeleteWord("");
                                setDeleteEmail("");
                              }}
                              className="rounded-xl border border-[#202E50] bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-300 hover:text-white"
                            >
                              Annuler
                            </button>
                          </div>
                        </form>
                      )}
                    </section>
                  </div>
                )}

                {/* ===================== VIEW: HELP (AIDE) ===================== */}
                {section === "help" && (
                  <div className="space-y-6">
                    <header className="rounded-3xl border border-[#202E50] bg-[#151F38] p-6 sm:p-8">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#397BFF]">Assistance</p>
                      <h2 className="mt-2 text-3xl font-black text-white">Aide et support</h2>
                      <p className="mt-2 text-sm text-[#8F9CAE]">
                        Envoyez une question ou une demande à l’équipe SkillFlow. Nous répondons sous 24 à 48 heures.
                      </p>
                    </header>

                    {/* Ticket Form */}
                    <section className="rounded-2xl border border-[#202E50] bg-[#151F38] p-6 sm:p-8">
                      <h3 className="text-xl font-bold text-white">Nouvelle demande</h3>
                      <form onSubmit={(e) => void createTicket(e)} className="mt-6 max-w-2xl space-y-4">
                        <div>
                          <label htmlFor="ticket-category" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#8F9CAE]">
                            Type de demande
                          </label>
                          <select
                            id="ticket-category"
                            name="category"
                            className="w-full rounded-xl border border-[#202E50] bg-[#0B1020] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#397BFF]"
                          >
                            <option value="question">Question sur un skill ou MCP</option>
                            <option value="refund">Demande de remboursement</option>
                            <option value="suggestion">Suggestion d&apos;amélioration</option>
                            <option value="other">Autre demande</option>
                          </select>
                        </div>

                        <div>
                          <label htmlFor="ticket-order" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#8F9CAE]">
                            Commande concernée (optionnel)
                          </label>
                          <select
                            id="ticket-order"
                            name="orderId"
                            defaultValue=""
                            className="w-full rounded-xl border border-[#202E50] bg-[#0B1020] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#397BFF]"
                          >
                            <option value="">Aucune commande</option>
                            {account.orders.map((order) => (
                              <option key={order.id} value={order.id}>
                                {order.products?.name ?? "SkillFlow"} · {new Date(order.created_at).toLocaleDateString("fr-FR")}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label htmlFor="ticket-subject" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#8F9CAE]">
                            Objet
                          </label>
                          <input
                            id="ticket-subject"
                            name="subject"
                            required
                            minLength={3}
                            maxLength={160}
                            placeholder="En quelques mots..."
                            className="w-full rounded-xl border border-[#202E50] bg-[#0B1020] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#397BFF]"
                          />
                        </div>

                        <div>
                          <label htmlFor="ticket-message" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#8F9CAE]">
                            Votre message
                          </label>
                          <textarea
                            id="ticket-message"
                            name="message"
                            required
                            minLength={10}
                            maxLength={5000}
                            rows={5}
                            placeholder="Détaillez votre demande pour nous aider à vous répondre au mieux..."
                            className="w-full resize-y rounded-xl border border-[#202E50] bg-[#0B1020] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#397BFF]"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={pending}
                          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-[#397BFF] to-[#6557FF] px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:brightness-110 disabled:opacity-50"
                        >
                          {pending ? "Envoi…" : "Envoyer la demande"}
                        </button>
                      </form>
                    </section>

                    {/* Existing Tickets List */}
                    <section className="rounded-2xl border border-[#202E50] bg-[#151F38] p-6 sm:p-8">
                      <h3 className="text-xl font-bold text-white">Mes demandes envoyées</h3>
                      {account.tickets.length === 0 ? (
                        <p className="mt-3 text-sm text-[#8F9CAE]">Vous n’avez pas encore envoyé de demande.</p>
                      ) : (
                        <div className="mt-5 space-y-3">
                          {account.tickets.map((ticket) => (
                            <div
                              key={ticket.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#202E50] bg-[#0B1020] p-4"
                            >
                              <div>
                                <p className="font-bold text-white">{ticket.subject}</p>
                                <p className="mt-0.5 text-xs text-[#8F9CAE]">
                                  {new Date(ticket.created_at).toLocaleDateString("fr-FR")}
                                </p>
                              </div>
                              <span className="rounded-full border border-[#202E50] bg-[#151F38] px-3 py-1 text-xs font-semibold text-[#8FB5FF]">
                                {ticketStatusLabel(ticket.status)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function SubscriptionOffers() {
  const offers = pricingOffers.filter((offer) => ["plus", "pro", "aios"].includes(offer.id));

  return (
    <div className="space-y-7">
      <header className="rounded-3xl border border-[#202E50] bg-[#151F38] p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#397BFF]">Votre abonnement</p>
        <h2 className="mt-2 text-3xl font-black text-white">Choisissez l’offre qui vous correspond</h2>
        <p className="mt-2 text-sm text-[#8F9CAE]">
          Passez d’un usage ponctuel à un espace de travail IA accompagné, puis construisez votre assistant personnel avec AIOS.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-3">
        {offers.map((offer) => {
          const isFeatured = offer.id === "pro";
          return (
            <article
              key={offer.id}
              className={`relative flex h-full flex-col rounded-3xl border p-7 shadow-xl transition-all duration-300 hover:-translate-y-1 ${
                isFeatured
                  ? "border-[#397BFF] bg-gradient-to-br from-[#18264A] via-[#151F38] to-[#121B32] shadow-[0_12px_40px_rgba(57,123,255,0.25)]"
                  : "border-[#202E50] bg-[#151F38]"
              }`}
            >
              {offer.highlight && (
                <span className="w-fit rounded-full bg-gradient-to-r from-[#397BFF] to-[#6557FF] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-sm">
                  {offer.highlight}
                </span>
              )}

              <h3 className="mt-4 text-2xl font-bold text-white">{offer.name}</h3>
              <div className="mt-3">
                <p className="text-3xl font-black text-white">{offer.price}</p>
                <p className="text-xs text-[#8F9CAE]">{offer.priceXof}</p>
              </div>

              <p className="mt-4 min-h-[48px] text-sm leading-relaxed text-[#8F9CAE]">{offer.description}</p>

              <ul className="mt-6 space-y-3 border-t border-[#202E50] pt-6 text-sm text-slate-200">
                {offer.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <span className="text-[#00E5FF]">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 pt-4">
                {offer.checkoutHref ? (
                  <Link
                    href={offer.checkoutHref}
                    className={`inline-flex min-h-12 w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-bold transition ${
                      isFeatured
                        ? "bg-gradient-to-r from-[#397BFF] to-[#6557FF] text-white shadow-[0_4px_16px_rgba(57,123,255,0.4)] hover:brightness-110"
                        : "border border-[#202E50] bg-white/[0.04] text-white hover:bg-white/[0.08]"
                    }`}
                  >
                    {offer.cta}
                  </Link>
                ) : (
                  <span className="block text-center text-xs font-semibold uppercase tracking-wider text-amber-200/80">
                    Disponible prochainement
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <div className="rounded-2xl border border-[#202E50] bg-[#11182B] p-4 text-sm leading-relaxed text-[#8F9CAE]">
        Les abonnements récurrents seront activés après la mise en place du paiement par abonnement. Les achats de skills et de packs restent disponibles depuis le catalogue.
      </div>
    </div>
  );
}
