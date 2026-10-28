"use client";

import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { ArrowRightIcon, CheckIcon } from "@/components/electric-icons";

type Skill = {
  id: string;
  slug: string;
  name: string;
  short_description: string;
  long_description: string;
  category_id: string;
  product_id?: string | null;
  price_cents: number;
  accessible: boolean;
  required_inputs: string[];
  output_types: string[];
  workflow: string[];
  skill_categories?: { name: string; slug: string } | null;
};

type Detail = {
  skill: Skill;
  configuration: { configuration_data: Record<string, string>; status: string } | null;
};

const cardClass = "rounded-2xl border border-[#202E50] bg-[#151F38] p-6 shadow-xl transition-all duration-300";
const fieldClass = "w-full rounded-xl border border-[#202E50] bg-[#0B1020] px-4 py-3 text-white outline-none transition focus:border-[#397BFF] focus:ring-2 focus:ring-[#397BFF]/20";

async function api<T = Record<string, unknown>>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await getSupabaseClient().auth.getSession();
  if (!data.session) throw new Error("Reconnectez-vous pour continuer.");
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${data.session.access_token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `La requête a échoué (${response.status}).`;
    throw new Error(message);
  }
  if (typeof payload !== "object" || payload === null) throw new Error("Réponse invalide du serveur.");
  return payload as T;
}

export function MemberSkills({ skillId }: { skillId?: string }) {
  const [items, setItems] = useState<Skill[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await api<{ items: Skill[] }>("/api/member/skills");
      setItems(result.items);
      if (skillId) {
        const found = result.items.find((item: Skill) => item.id === skillId || item.slug === skillId);
        if (!found) throw new Error("Skill introuvable.");
        const response = await api<Detail>(`/api/member/skills/${found.id}`);
        setDetail(response);
        setForm(response.configuration?.configuration_data ?? {});
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, [skillId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!detail) return;
    setPending(true);
    setError("");
    try {
      const result = await api<{ configuration: NonNullable<Detail["configuration"]> }>(
        `/api/member/skills/${detail.skill.id}`,
        { method: "PUT", body: JSON.stringify({ configuration: form }) }
      );
      setDetail({ ...detail, configuration: result.configuration });
      setNotice("Configuration enregistrée dans votre espace privé.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Enregistrement impossible.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0B1020] px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <BackLink href="/account">Mon espace Skillsflow</BackLink>
          <Link href="/member/skills" className="text-sm text-[#8F9CAE] hover:text-white transition">
            Tous les skills
          </Link>
        </header>

        <div className="rounded-3xl border border-[#202E50] bg-[#151F38] p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#397BFF]">Skillsflow • Espace membre</p>
          <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
            {skillId ? detail?.skill.name ?? "Votre skill" : "Bibliothèque de skills"}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#8F9CAE]">
            Configurez vos outils métier. Vos réglages restent strictement privés et rattachés à votre compte.
          </p>

          <div className="mt-6">
            <Link
              href="/member/prospection"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#397BFF]/30 bg-[#397BFF]/10 px-5 text-sm font-semibold text-[#8FB5FF] transition hover:bg-[#397BFF]/20"
            >
              <span>Ouvrir Skillsflow Prospection</span>
              <span>↗</span>
            </Link>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="mt-6 rounded-2xl border border-[#00F0A0]/30 bg-[#00F0A0]/10 p-4 text-sm text-[#00F0A0]">
            {notice}
          </p>
        )}

        {loading ? (
          <div className="flex min-h-[250px] items-center justify-center text-sm text-[#8F9CAE]">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#397BFF] border-t-transparent" />
              <span>Chargement…</span>
            </div>
          </div>
        ) : detail ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_20rem]">
            {/* Main Form */}
            <section className={cardClass}>
              <span className="rounded-full border border-[#B3A4FF]/30 bg-[#6557FF]/15 px-3 py-1 text-xs font-semibold text-[#B3A4FF]">
                {detail.skill.skill_categories?.name ?? "Skill IA"}
              </span>
              <p className="mt-4 text-sm leading-relaxed text-[#8F9CAE]">{detail.skill.long_description}</p>

              <h2 className="mt-8 text-xl font-bold text-white">Configurez votre contexte</h2>
              <form onSubmit={(e) => void save(e)} className="mt-5 space-y-5">
                {(detail.skill.required_inputs ?? []).map((raw) => {
                  const name = String(raw);
                  return (
                    <label key={name} className="block text-sm font-semibold capitalize text-slate-200">
                      {name.replaceAll("_", " ")}
                      <textarea
                        className={`${fieldClass} mt-2 min-h-24 resize-y font-normal`}
                        value={form[name] ?? ""}
                        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
                        maxLength={5000}
                      />
                    </label>
                  );
                })}

                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-xl bg-gradient-to-r from-[#397BFF] to-[#6557FF] px-6 py-3 font-bold text-white shadow-md transition hover:brightness-110 disabled:opacity-60"
                >
                  {pending ? "Enregistrement…" : "Enregistrer mon profil de travail"}
                </button>
              </form>
            </section>

            {/* Sidebar */}
            <aside className="space-y-5">
              <div className={cardClass}>
                <h3 className="font-bold text-white">Parcours conseillé</h3>
                <ol className="mt-4 space-y-3 text-sm text-[#8F9CAE]">
                  {detail.skill.workflow?.map((step, index) => (
                    <li key={step} className="flex gap-3">
                      <span className="font-mono text-xs font-bold text-[#397BFF]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className={cardClass}>
                <h3 className="font-bold text-white">Livrables possibles</h3>
                <ul className="mt-4 space-y-2 text-sm text-[#8F9CAE]">
                  {detail.skill.output_types?.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <CheckIcon className="h-3.5 w-3.5 text-[#00E5FF]" />
                      <span>{item.replaceAll("_", " ")}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href={`/member/skills/${detail.skill.id}/agent`}
                className="flex items-center justify-between rounded-2xl border border-[#397BFF]/30 bg-[#397BFF]/10 p-5 text-sm font-bold text-[#8FB5FF] transition hover:bg-[#397BFF]/20"
              >
                <span>Ouvrir l’agent IA</span>
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </aside>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <article
                key={item.id}
                className="group flex flex-col justify-between rounded-2xl border border-[#202E50] bg-[#151F38] p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-[#397BFF]/50"
              >
                <div>
                  <span className="rounded-full border border-[#B3A4FF]/30 bg-[#6557FF]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#B3A4FF]">
                    {item.skill_categories?.name ?? "Skill IA"}
                  </span>
                  <h2 className="mt-3 text-xl font-bold text-white group-hover:text-[#8FB5FF] transition">{item.name}</h2>
                  <p className="mt-2 min-h-[48px] text-sm leading-6 text-[#8F9CAE]">{item.short_description}</p>
                </div>

                <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#202E50] pt-4">
                  <div>
                    <p className="text-sm font-bold text-white">€{(item.price_cents / 100).toFixed(2)}</p>
                    <p className="text-xs text-[#8F9CAE]">
                      {new Intl.NumberFormat("fr-FR").format(Math.round((item.price_cents / 100) * 655.957))} XOF
                    </p>
                    {item.accessible && <p className="mt-1 text-xs font-semibold text-[#00F0A0]">Accès inclus</p>}
                    {!item.accessible && !item.product_id && (
                      <p className="mt-1 text-xs text-amber-300/80">En préparation</p>
                    )}
                  </div>

                  <Link
                    href={
                      item.accessible
                        ? `/member/skills/${item.id}/setup`
                        : item.product_id
                        ? `/products/${item.slug}`
                        : "/shop"
                    }
                    className="rounded-xl bg-gradient-to-r from-[#397BFF] to-[#6557FF] px-4 py-2 text-xs font-bold text-white shadow-md transition hover:brightness-110 active:scale-95"
                  >
                    {item.accessible ? "Configurer" : item.product_id ? "Voir l’accès" : "Catalogue"}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
