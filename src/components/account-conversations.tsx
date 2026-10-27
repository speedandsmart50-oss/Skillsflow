"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { getSupabaseClient } from "@/lib/supabase/client";
import { matchesFileContentType } from "@/lib/security/file-content";

type ConversationExample = {
  id: string;
  title: string;
  conversation_text: string;
  screenshot_paths: string[];
  created_at: string;
};

const bucket = "agent-conversations";
const inputClass =
  "min-h-11 w-full rounded-xl border border-[#202E50] bg-[#0B1020] px-4 py-2.5 text-sm text-white outline-none placeholder:text-[#64748B] transition focus:border-[#397BFF] focus:ring-2 focus:ring-[#397BFF]/20";

export function AccountConversations() {
  const [items, setItems] = useState<ConversationExample[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [screenshots, setScreenshots] = useState<Record<string, string[]>>({});

  const load = useCallback(async () => {
    const client = getSupabaseClient();
    const { data, error: loadError } = await client
      .from("agent_conversations")
      .select("id, title, conversation_text, screenshot_paths, created_at")
      .order("created_at", { ascending: false });
    if (loadError) throw new Error("La base n’est pas encore prête. Appliquez la migration Supabase 010.");
    const rows = (data ?? []) as ConversationExample[];
    setItems(rows);
    const signedEntries = await Promise.all(
      rows.map(async (row) => {
        if (!row.screenshot_paths.length) return [row.id, []] as const;
        const signed = await client.storage.from(bucket).createSignedUrls(row.screenshot_paths, 3600);
        return [row.id, (signed.data ?? []).flatMap((file) => (file.signedUrl ? [file.signedUrl] : []))] as const;
      })
    );
    setScreenshots(Object.fromEntries(signedEntries));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
        .catch((caught: unknown) => {
          setError(caught instanceof Error ? caught.message : "Impossible de charger vos exemples.");
        })
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError("");
    setNotice("");
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const tone = String(form.get("tone") ?? "").trim();
    const responseStyle = String(form.get("responseStyle") ?? "").trim();
    const example = String(form.get("conversation") ?? "").trim();
    const conversationText = [
      tone && `Ton souhaité : ${tone}`,
      responseStyle && `Manière de répondre : ${responseStyle}`,
      `Situation et exemple : ${example}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    const anonymizedConversation = conversationText
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]")
      .replace(/(?:\+?\d[\d .()/-]{7,}\d)/g, "[TÉLÉPHONE]")
      .replace(/https?:\/\/\S+/gi, "[LIEN]");
    const files = Array.from((form.getAll("screenshots") as File[]).filter((file) => file.size > 0));
    if (conversationText.length < 20 || conversationText.length > 30000) {
      setError("La conversation doit contenir entre 20 et 30 000 caractères.");
      setSaving(false);
      return;
    }
    if (
      files.length > 6 ||
      files.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 7 * 1024 * 1024)
    ) {
      setError("Ajoutez au maximum 6 images JPEG, PNG ou WebP de 7 Mo chacune.");
      setSaving(false);
      return;
    }
    const imageSignaturesMatch = await Promise.all(
      files.map(async (file) =>
        matchesFileContentType(new Uint8Array(await file.slice(0, 12).arrayBuffer()), file.type)
      )
    );
    if (imageSignaturesMatch.some((matches) => !matches)) {
      setError("Le contenu d’une capture ne correspond pas à son format d’image.");
      setSaving(false);
      return;
    }
    const client = getSupabaseClient();
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    const { data: auth, error: authError } = await client.auth.getUser();
    if (sessionError || authError || !auth.user || !sessionData.session?.access_token) {
      setError("Reconnectez-vous pour envoyer un exemple.");
      setSaving(false);
      return;
    }
    const id = crypto.randomUUID();
    const uploaded: string[] = [];
    try {
      for (const [index, file] of files.entries()) {
        const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
        const path = `${auth.user.id}/${id}/${index + 1}.${ext}`;
        const { error: uploadError } = await client.storage
          .from(bucket)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw new Error("Une capture n’a pas pu être envoyée. Vérifiez la migration Supabase.");
        uploaded.push(path);
      }
      const response = await fetch("/api/account/conversations", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + sessionData.session.access_token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, title, conversation: anonymizedConversation, screenshotPaths: uploaded }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "Votre exemple n’a pas pu être enregistré.");
      formElement.reset();
      await load();
      setNotice("Exemple privé enregistré dans votre espace agent.");
    } catch (caught) {
      if (uploaded.length) await client.storage.from(bucket).remove(uploaded);
      setError(caught instanceof Error ? caught.message : "Impossible d’enregistrer cet exemple.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: ConversationExample) {
    setError("");
    setNotice("");
    const client = getSupabaseClient();
    const { error: rowError } = await client.from("agent_conversations").delete().eq("id", item.id);
    if (rowError) {
      setError("Impossible de supprimer cet exemple.");
      return;
    }
    if (item.screenshot_paths.length) await client.storage.from(bucket).remove(item.screenshot_paths);
    setItems((current) => current.filter((row) => row.id !== item.id));
    setNotice("Exemple supprimé.");
  }

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-[#202E50] bg-[#151F38] p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#397BFF]">Repères de communication</p>
        <h2 className="mt-2 text-3xl font-black text-white">Montrez à votre agent comment vous échangez</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#8F9CAE]">
          Ajoutez des situations et réponses qui vous ressemblent. Ces exemples concrets l’aideront à reproduire fidèlement votre ton et votre style.
        </p>
      </header>

      {(error || notice) && (
        <p
          role={error ? "alert" : "status"}
          className={`rounded-2xl border p-4 text-sm font-medium ${
            error ? "border-rose-500/30 bg-rose-500/10 text-rose-200" : "border-[#00F0A0]/30 bg-[#00F0A0]/10 text-[#00F0A0]"
          }`}
        >
          {error || notice}
        </p>
      )}

      {/* Add form */}
      <form onSubmit={(event) => void submit(event)} className="space-y-5 rounded-3xl border border-[#202E50] bg-[#151F38] p-6 sm:p-8">
        <div>
          <h3 className="text-lg font-bold text-white">Ajouter un repère</h3>
          <p className="mt-1 text-sm text-[#8F9CAE]">Choisissez une situation représentative de votre manière de répondre.</p>
        </div>

        <div>
          <label htmlFor="example-title" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#8F9CAE]">
            Situation
          </label>
          <input
            id="example-title"
            name="title"
            required
            minLength={1}
            maxLength={120}
            className={inputClass}
            placeholder="Ex. Répondre à une demande d’information client"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="agent-tone" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#8F9CAE]">
              Ton souhaité <span className="font-normal text-[#64748B]">(facultatif)</span>
            </label>
            <input
              id="agent-tone"
              name="tone"
              maxLength={500}
              className={inputClass}
              placeholder="Ex. chaleureux, direct, rassurant"
            />
          </div>
          <div>
            <label htmlFor="agent-style" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#8F9CAE]">
              Manière de répondre <span className="font-normal text-[#64748B]">(facultatif)</span>
            </label>
            <input
              id="agent-style"
              name="responseStyle"
              maxLength={500}
              className={inputClass}
              placeholder="Ex. phrases concises, exemples chiffrés"
            />
          </div>
        </div>

        <div>
          <label htmlFor="example-conversation" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#8F9CAE]">
            Exemple d’échange
          </label>
          <textarea
            id="example-conversation"
            name="conversation"
            required
            minLength={20}
            maxLength={30000}
            rows={7}
            className={`${inputClass} resize-y font-normal`}
            placeholder="Décrivez la situation et votre réponse type..."
          />
          <p className="mt-2 text-xs text-[#64748B]">Retirez les noms, coordonnées et informations privées avant d’enregistrer.</p>
        </div>

        <details className="rounded-xl border border-[#202E50] bg-[#0B1020] p-4">
          <summary className="cursor-pointer text-sm font-semibold text-[#8FB5FF]">Ajouter un support visuel (facultatif)</summary>
          <div className="mt-3">
            <label htmlFor="example-screenshots" className="mb-1.5 block text-xs font-medium text-slate-300">
              Image ou capture de contexte
            </label>
            <input
              id="example-screenshots"
              name="screenshots"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="block w-full text-sm text-[#8F9CAE] file:mr-4 file:rounded-xl file:border-0 file:bg-[#397BFF] file:px-4 file:py-2 file:text-xs file:font-bold file:text-white"
            />
            <p className="mt-1 text-xs text-[#64748B]">Ajoutez uniquement des images dont vous possédez les droits.</p>
          </div>
        </details>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-[#397BFF] to-[#6557FF] px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:brightness-110 disabled:opacity-60"
        >
          {saving ? "Enregistrement…" : "Enregistrer ce repère"}
        </button>
      </form>

      {/* List */}
      <section className="space-y-4">
        <div>
          <h3 className="text-xl font-bold text-white">Mes repères enregistrés</h3>
          <p className="mt-1 text-sm text-[#8F9CAE]">Vous pouvez consulter ou supprimer vos exemples à tout moment.</p>
        </div>

        {loading ? (
          <div className="flex min-h-[120px] items-center justify-center text-sm text-[#8F9CAE]">Chargement…</div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-[#202E50] bg-[#151F38] p-6 text-sm text-[#8F9CAE]">
            Aucun exemple pour le moment.
          </div>
        ) : (
          items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-[#202E50] bg-[#151F38] p-6 shadow-md">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="font-bold text-white">{item.title}</h4>
                  <p className="mt-1 text-xs text-[#8F9CAE]">
                    Ajouté le {new Date(item.created_at).toLocaleDateString("fr-FR")}
                    {item.screenshot_paths.length ? " • support visuel joint" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void remove(item)}
                  className="text-xs font-semibold text-rose-300 underline underline-offset-4 hover:text-rose-200"
                >
                  Supprimer
                </button>
              </div>

              <details className="mt-4">
                <summary className="cursor-pointer text-xs font-semibold text-[#8FB5FF]">Voir l&apos;exemple complet</summary>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-[#202E50] bg-[#0B1020] p-4 font-sans text-sm leading-relaxed text-slate-200">
                  {item.conversation_text}
                </pre>
              </details>

              {(screenshots[item.id]?.length ?? 0) > 0 && (
                <div className="mt-4 flex flex-wrap gap-3">
                  {screenshots[item.id].map((src, index) => (
                    <a key={src} href={src} target="_blank" rel="noreferrer">
                      <Image
                        unoptimized
                        width={128}
                        height={96}
                        src={src}
                        alt={`Capture ${index + 1} de ${item.title}`}
                        className="h-24 w-32 rounded-xl border border-[#202E50] object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
