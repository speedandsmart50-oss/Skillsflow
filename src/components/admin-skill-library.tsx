"use client";

import { BackLink } from "@/components/back-link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { parseSkillDocument, toEditableSkillDocument } from "@/lib/skills/parse-skill-document";

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
  content: string;
  category_id: string;
  price: string;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-white/10 bg-[#0b1524] p-2 text-sm text-white";

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
  const [editingSkillId, setEditingSkillId] = useState("");
  const [skillTextDraft, setSkillTextDraft] = useState("");
  const [loadingEditor, setLoadingEditor] = useState(false);
  const [form, setForm] = useState<SkillForm>({
    content: "",
    category_id: "",
    price: "",
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

  async function openSkillEditor(skill: LibrarySkill) {
    setError("");
    setNotice("");
    setLoadingEditor(true);
    try {
      const response = await fetch(`/api/admin/skill-library?skillId=${encodeURIComponent(skill.id)}`, {
        headers: await getAuthorizationHeader(),
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Impossible de charger le texte du skill.");
      setSkillTextDraft(toEditableSkillDocument({
        name: payload.skill.name,
        description: payload.skill.long_description || payload.skill.system_prompt || payload.skill.short_description,
      }));
      setEditingSkillId(skill.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de charger le texte du skill.");
    } finally {
      setLoadingEditor(false);
    }
  }

  async function saveSkillContent(event: FormEvent<HTMLFormElement>, skill: LibrarySkill) {
    event.preventDefault();
    if (!parseSkillDocument(skillTextDraft)) {
      setError("Le texte doit contenir un titre « # Nom du skill » et une section « ## Description courte » (500 caractères maximum).");
      return;
    }
    setPending(skill.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/skill-library", {
        method: "PATCH",
        headers: { ...await getAuthorizationHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ id: skill.id, content: skillTextDraft }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Modification impossible.");
      setSkills((current) => current.map((item) => item.id === skill.id ? payload.skill : item));
      setEditingSkillId("");
      setSkillTextDraft("");
      setNotice(`Le skill « ${payload.skill.name} » a été amélioré.`);
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
    if (!form.price.trim() || !Number.isFinite(price) || price < 0 || !Number.isSafeInteger(priceCents) || priceCents > 2_147_483_647) {
      setError("Saisissez un prix valide en euros.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/skill-library", {
        method: "POST",
        headers: { ...await getAuthorizationHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({
          content: form.content,
          category_id: form.category_id,
          price_cents: priceCents,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Création impossible.");
      setSkills((current) => [...current, payload.skill].sort((a, b) => a.name.localeCompare(b.name)));
      setForm({
        content: "",
        category_id: categories[0]?.id ?? "",
        price: "",
      });
      setCreating(false);
      setNotice(`Skill « ${payload.skill.name} » ajouté à la bibliothèque et activé.`);
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
            <p className="mt-1 text-sm text-slate-400">Collez le texte complet du skill. Le nom et le slug seront générés à partir du titre; le skill sera actif dès sa création.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-xs text-slate-400 sm:col-span-2">
                Texte complet du skill
                <textarea
                  required
                  minLength={20}
                  maxLength={30000}
                  rows={16}
                  value={form.content}
                  onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
                  placeholder={`# Nom du skill\n\n## Description courte\nDécrivez le résultat en quelques phrases (500 caractères maximum).\n\n## Promesse\nQuel résultat concret le skill aide-t-il à obtenir ?\n\n## Cas d'utilisation\n- Premier cas d'utilisation\n\n## Entrées requises\n- Informations nécessaires pour commencer\n\n## Formats de sortie\n- Livrable attendu\n\n## Étapes du workflow\n1. Première étape\n2. Vérification du résultat\n\n## Outils MCP\n- Outil nécessaire, s'il y en a un\n\n## Instructions\nDécrivez ici le comportement complet du skill, ses règles, ses limites et ses exemples.`}
                  className={`${inputClass} font-mono leading-6`}
                />
              </label>
              <p className="text-xs leading-5 text-slate-400 sm:col-span-2">
                Utilisez le format Markdown ci-dessus : le titre « # » fournit le nom, « ## Description courte » est obligatoire. Les autres sections structurent automatiquement les entrées, sorties et étapes. Le texte complet est conservé comme instructions du skill.
              </p>
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
              <article
                key={skill.id}
                className={`grid gap-4 rounded-2xl border border-white/10 bg-[#111a2b] p-4 ${editingSkillId === skill.id ? "lg:grid-cols-1" : "lg:grid-cols-[1fr_14rem_8rem_10rem]"}`}
              >
                <div>
                  <h2 className="font-semibold">{skill.name}</h2>
                  <p className="mt-1 text-xs text-slate-400">{skill.slug}</p>
                  <p className="mt-2 text-sm text-slate-300">{skill.short_description}</p>
                  {editingSkillId === skill.id ? (
                    <form className="mt-4 space-y-3 rounded-xl border border-cyan-200/20 bg-[#0b1524] p-4" onSubmit={(event) => void saveSkillContent(event, skill)}>
                      <label className="block text-xs text-slate-400">
                        Améliorer le texte complet du skill
                        <textarea
                          required
                          minLength={20}
                          maxLength={30000}
                          rows={16}
                          value={skillTextDraft}
                          onChange={(event) => setSkillTextDraft(event.target.value)}
                          className={`${inputClass} font-mono leading-6`}
                        />
                      </label>
                      <p className="text-xs leading-5 text-slate-400">Enregistrer remplace le contenu actuel. Le nom est actualisé depuis le titre; le slug reste stable.</p>
                      <div className="flex flex-wrap gap-2">
                        <button type="submit" disabled={pending === skill.id} className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">
                          {pending === skill.id ? "Enregistrement…" : "Enregistrer le skill amélioré"}
                        </button>
                        <button type="button" disabled={pending === skill.id} onClick={() => { setEditingSkillId(""); setSkillTextDraft(""); }} className="rounded-full border border-white/15 px-4 py-2 text-sm">
                          Annuler
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      disabled={loadingEditor}
                      onClick={() => void openSkillEditor(skill)}
                      className="mt-4 rounded-full border border-cyan-200/30 px-4 py-2 text-xs font-medium text-cyan-100 disabled:opacity-50"
                    >
                      {loadingEditor ? "Chargement…" : "Améliorer le skill"}
                    </button>
                  )}
                </div>
                {editingSkillId !== skill.id && (
                  <>
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
                  </>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
