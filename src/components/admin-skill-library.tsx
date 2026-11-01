"use client";

import { BackLink } from "@/components/back-link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

type LibrarySkill = {
  id: string;
  slug: string;
  name: string;
  category_id: string;
  short_description: string;
  price_cents: number;
  is_active: boolean;
  is_included_in_membership: boolean;
  product_id: string | null;
};

type Category = { id: string; name: string };
type SkillForm = {
  name: string;
  slug: string;
  category_id: string;
  short_description: string;
  price: string;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-white/10 bg-[#0b1524] p-2 text-sm text-white";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function getAuthorizationHeader() {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw new Error("Impossible de vérifier votre session.");
  if (!data.session?.access_token) throw new Error("Connectez-vous pour continuer.");
  return { Authorization: `Bearer ${data.session.access_token}` };
}

export function AdminSkillLibrary() {
  const [skills, setSkills] = useState<LibrarySkill[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [form, setForm] = useState<SkillForm>({
    name: "",
    slug: "",
    category_id: "",
    short_description: "",
    price: "0",
  });

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/skill-library", {
      headers: await getAuthorizationHeader(),
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Chargement impossible.");
    setSkills(payload.skills);
    setCategories(payload.categories);
    setForm((current) => ({
      ...current,
      category_id: current.category_id || payload.categories[0]?.id || "",
    }));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
        .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Chargement impossible."))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function update(skill: LibrarySkill, changes: Partial<LibrarySkill>) {
    setPending(skill.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/skill-library", {
        method: "PATCH",
        headers: { ...await getAuthorizationHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ id: skill.id, ...changes }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Modification impossible.");
      setSkills((current) => current.map((item) => item.id === skill.id ? payload.skill : item));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Modification impossible.");
    } finally {
      setPending("");
    }
  }

  async function createSkill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const price = Number(form.price);
    const priceCents = Math.round(price * 100);
    if (!Number.isFinite(price) || price < 0 || !Number.isSafeInteger(priceCents) || priceCents > 2_147_483_647) {
      setError("Saisissez un prix valide en euros.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/skill-library", {
        method: "POST",
        headers: { ...await getAuthorizationHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          category_id: form.category_id,
          short_description: form.short_description,
          price_cents: priceCents,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Création impossible.");
      setSkills((current) => [...current, payload.skill].sort((a, b) => a.name.localeCompare(b.name)));
      setForm({
        name: "",
        slug: "",
        category_id: categories[0]?.id ?? "",
        short_description: "",
        price: "0",
      });
      setSlugTouched(false);
      setCreating(false);
      setNotice("Skill ajouté à la bibliothèque et activé.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Création impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b1020] px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <BackLink href="/admin">Administration</BackLink>
            <h1 className="mt-3 text-3xl font-semibold">Bibliothèque de skills</h1>
            <p className="mt-2 text-sm text-slate-300">Publication, rattachement aux produits et accès inclus.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-cyan-200/20 px-3 py-2 text-sm text-cyan-100">
              {skills.length} skills
            </span>
            <button
              type="button"
              onClick={() => {
                setCreating((current) => !current);
                setError("");
                setNotice("");
              }}
              className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              {creating ? "Annuler" : "Ajouter un skill"}
            </button>
          </div>
        </header>

        {error && <p role="alert" className="mt-5 rounded-xl bg-rose-300/10 p-4 text-rose-100">{error}</p>}
        {notice && <p role="status" className="mt-5 rounded-xl bg-emerald-300/10 p-4 text-emerald-100">{notice}</p>}

        {creating && (
          <form onSubmit={(event) => void createSkill(event)} className="mt-7 rounded-2xl border border-cyan-200/20 bg-[#111a2b] p-5">
            <h2 className="text-lg font-semibold">Nouveau skill</h2>
            <p className="mt-1 text-sm text-slate-400">Le skill sera actif dès sa création.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-xs text-slate-400">
                Nom
                <input
                  required
                  minLength={2}
                  maxLength={160}
                  value={form.name}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    name: event.target.value,
                    slug: slugTouched ? current.slug : slugify(event.target.value),
                  }))}
                  className={inputClass}
                />
              </label>
              <label className="text-xs text-slate-400">
                Slug
                <input
                  required
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  title="Minuscules, chiffres et tirets uniquement."
                  value={form.slug}
                  onChange={(event) => {
                    setSlugTouched(true);
                    setForm((current) => ({ ...current, slug: event.target.value }));
                  }}
                  className={inputClass}
                />
              </label>
              <label className="text-xs text-slate-400">
                Catégorie
                <select
                  required
                  value={form.category_id}
                  onChange={(event) => setForm((current) => ({ ...current, category_id: event.target.value }))}
                  className={inputClass}
                >
                  {categories.length === 0 && <option value="">Aucune catégorie disponible</option>}
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-400">
                Prix (€)
                <input
                  required
                  type="number"
                  min="0"
                  max="21474836.47"
                  step="0.01"
                  value={form.price}
                  onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                  className={inputClass}
                />
              </label>
              <label className="text-xs text-slate-400 sm:col-span-2">
                Courte description
                <textarea
                  required
                  maxLength={500}
                  rows={3}
                  value={form.short_description}
                  onChange={(event) => setForm((current) => ({ ...current, short_description: event.target.value }))}
                  className={inputClass}
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                disabled={saving || categories.length === 0}
                className="rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Création…" : "Créer le skill"}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="mt-8 text-slate-400">Chargement…</p>
        ) : skills.length === 0 ? (
          <p className="mt-7 rounded-2xl border border-white/10 bg-[#111a2b] p-6 text-sm text-slate-300">
            Aucun skill pour le moment. Utilisez « Ajouter un skill » pour créer le premier.
          </p>
        ) : (
          <div className="mt-7 space-y-3">
            {skills.map((skill) => (
              <article key={skill.id} className="grid gap-4 rounded-2xl border border-white/10 bg-[#111a2b] p-4 lg:grid-cols-[1fr_14rem_8rem_10rem]">
                <div>
                  <h2 className="font-semibold">{skill.name}</h2>
                  <p className="mt-1 text-xs text-slate-400">{skill.slug}</p>
                  <p className="mt-2 text-sm text-slate-300">{skill.short_description}</p>
                </div>
                <label className="text-xs text-slate-400">
                  Catégorie
                  <select
                    value={skill.category_id}
                    disabled={pending === skill.id}
                    onChange={(event) => void update(skill, { category_id: event.target.value })}
                    className={inputClass}
                  >
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>
                <label className="text-xs text-slate-400">
                  Prix (€)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={(skill.price_cents / 100).toFixed(2)}
                    disabled={pending === skill.id}
                    onBlur={(event) => {
                      const value = Math.round(Number(event.currentTarget.value) * 100);
                      if (value !== skill.price_cents) void update(skill, { price_cents: value });
                    }}
                    className={inputClass}
                  />
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={pending === skill.id}
                    onClick={() => void update(skill, { is_active: !skill.is_active })}
                    className="rounded-full border border-white/15 px-3 py-2 text-xs"
                  >
                    {skill.is_active ? "Désactiver" : "Activer"}
                  </button>
                  <span className="text-xs text-slate-400">{skill.product_id ? "Produit lié" : "Pas de produit lié"}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
