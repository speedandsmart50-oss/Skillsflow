"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { getSupabaseClient } from "@/lib/supabase/client";

type ConversationExample = {
  id: string;
  title: string;
  conversation_text: string;
  screenshot_paths: string[];
  created_at: string;
};

const bucket = "agent-conversations";
const inputClass = "min-h-11 w-full rounded-xl border border-white/15 bg-[#0b1524] px-3.5 py-2.5 text-base text-white outline-none placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-cyan-300";

export function AccountConversations() {
  const [items, setItems] = useState<ConversationExample[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [screenshots, setScreenshots] = useState<Record<string, string[]>>({});

  const load = useCallback(async () => {
    const client = getSupabaseClient();
    const { data, error: loadError } = await client.from("agent_conversations")
      .select("id, title, conversation_text, screenshot_paths, created_at")
      .order("created_at", { ascending: false });
    if (loadError) throw new Error("La base n’est pas encore prête. Appliquez la migration Supabase 010.");
    const rows = (data ?? []) as ConversationExample[];
    setItems(rows);
    const signedEntries = await Promise.all(rows.map(async (row) => {
      if (!row.screenshot_paths.length) return [row.id, []] as const;
      const signed = await client.storage.from(bucket).createSignedUrls(row.screenshot_paths, 3600);
      return [row.id, (signed.data ?? []).flatMap((file) => file.signedUrl ? [file.signedUrl] : [])] as const;
    }));
    setScreenshots(Object.fromEntries(signedEntries));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Impossible de charger vos exemples.");
      }).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError(""); setNotice(""); setSaving(true);
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const conversationText = String(form.get("conversation") ?? "").trim();
    const anonymizedConversation = conversationText
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]")
      .replace(/(?:\+?\d[\d .()/-]{7,}\d)/g, "[TÉLÉPHONE]")
      .replace(/https?:\/\/\S+/gi, "[LIEN]");
    const files = Array.from((form.getAll("screenshots") as File[]).filter((file) => file.size > 0));
    if (conversationText.length < 20 || conversationText.length > 30000) {
      setError("La conversation doit contenir entre 20 et 30 000 caractères."); setSaving(false); return;
    }
    if (files.length > 6 || files.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 7 * 1024 * 1024)) {
      setError("Ajoutez au maximum 6 images JPEG, PNG ou WebP de 7 Mo chacune."); setSaving(false); return;
    }
    const client = getSupabaseClient();
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) { setError("Reconnectez-vous pour envoyer un exemple."); setSaving(false); return; }
    const id = crypto.randomUUID();
    const uploaded: string[] = [];
    try {
      for (const [index, file] of files.entries()) {
        const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
        const path = `${auth.user.id}/${id}/${index + 1}.${ext}`;
        const { error: uploadError } = await client.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw new Error("Une capture n’a pas pu être envoyée. Vérifiez que la migration Supabase 010 est appliquée.");
        uploaded.push(path);
      }
      const { error: insertError } = await client.from("agent_conversations").insert({
        id, user_id: auth.user.id, title, conversation_text: anonymizedConversation, screenshot_paths: uploaded,
      });
      if (insertError) throw new Error("Votre exemple n’a pas pu être enregistré. Vérifiez que la migration Supabase 010 est appliquée.");
      formElement.reset();
      await load();
      setNotice("Exemple privé enregistré dans votre espace agent.");
    } catch (caught) {
      if (uploaded.length) await client.storage.from(bucket).remove(uploaded);
      setError(caught instanceof Error ? caught.message : "Impossible d’enregistrer cet exemple.");
    } finally { setSaving(false); }
  }

  async function remove(item: ConversationExample) {
    setError(""); setNotice("");
    const client = getSupabaseClient();
    const { error: rowError } = await client.from("agent_conversations").delete().eq("id", item.id);
    if (rowError) { setError("Impossible de supprimer cet exemple."); return; }
    if (item.screenshot_paths.length) await client.storage.from(bucket).remove(item.screenshot_paths);
    setItems((current) => current.filter((row) => row.id !== item.id));
    setNotice("Exemple supprimé.");
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Votre agent personnel</p>
        <h2 className="mt-2 font-[family-name:var(--font-bricolage)] text-2xl font-semibold text-white">Exemples de conversations</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Ajoutez une conversation et ses captures pour constituer votre bibliothèque privée. Ces exemples ne déclenchent pas encore d’entraînement automatique.</p>
      </header>
      {(error || notice) && <p role={error ? "alert" : "status"} className={`rounded-2xl border p-4 text-sm ${error ? "border-rose-300/25 bg-rose-300/10 text-rose-100" : "border-cyan-300/25 bg-cyan-300/10 text-cyan-100"}`}>{error || notice}</p>}
      <form onSubmit={(event) => void submit(event)} className="account-card space-y-4 rounded-3xl p-5 sm:p-7">
        <div><label htmlFor="example-title" className="mb-1.5 block text-sm font-semibold text-white">Nom de l’exemple</label><input id="example-title" name="title" required minLength={1} maxLength={120} className={inputClass} placeholder="Ex. Réponse à une demande client" /></div>
        <div><label htmlFor="example-conversation" className="mb-1.5 block text-sm font-semibold text-white">Conversation à partager</label><textarea id="example-conversation" name="conversation" required minLength={20} maxLength={30000} rows={8} className={`${inputClass} resize-y`} placeholder="Collez la conversation; les e-mails, téléphones et liens seront masqués avant l’enregistrement." /><p className="mt-2 text-xs text-slate-400">Les captures sont stockées dans votre espace privé. L’extraction OCR n’est pas activée pour le moment.</p></div>
        <div><label htmlFor="example-screenshots" className="mb-1.5 block text-sm font-semibold text-white">Captures d’écran (facultatif)</label><input id="example-screenshots" name="screenshots" type="file" multiple accept="image/jpeg,image/png,image/webp" className="block w-full text-sm text-slate-300 file:mr-4 file:min-h-10 file:rounded-full file:border-0 file:bg-cyan-300 file:px-4 file:font-semibold file:text-slate-950" /><p className="mt-2 text-xs text-slate-400">6 images maximum · JPEG, PNG ou WebP · 7 Mo par image</p></div>
        <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center justify-center rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-60">{saving ? "Enregistrement…" : "Envoyer à mon espace agent"}</button>
      </form>
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-white">Mes exemples enregistrés</h3>
        {loading ? <p className="text-sm text-slate-400">Chargement…</p> : items.length === 0 ? <p className="account-card rounded-2xl p-5 text-sm text-slate-300">Aucun exemple pour le moment.</p> : items.map((item) => (
          <article key={item.id} className="account-card rounded-2xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-semibold text-white">{item.title}</h4><p className="mt-1 text-xs text-slate-400">Ajouté le {new Date(item.created_at).toLocaleDateString("fr-FR")} · {item.screenshot_paths.length} capture(s)</p></div><button type="button" onClick={() => void remove(item)} className="text-sm font-semibold text-rose-200 underline underline-offset-4">Supprimer</button></div>
            <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-cyan-200">Afficher la conversation</summary><pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-[#0b1524] p-4 font-sans text-sm leading-6 text-slate-200">{item.conversation_text}</pre></details>
            {(screenshots[item.id]?.length ?? 0) > 0 && <div className="mt-4 flex flex-wrap gap-3">{screenshots[item.id].map((src, index) => <a key={src} href={src} target="_blank" rel="noreferrer"><Image unoptimized width={128} height={96} src={src} alt={`Capture ${index + 1} de ${item.title}`} className="h-24 w-32 rounded-xl border border-white/10 object-cover" /></a>)}</div>}
          </article>
        ))}
      </section>
    </div>
  );
}
