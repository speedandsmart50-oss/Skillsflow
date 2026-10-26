"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

type Reaction = { id: string; user_id: string; emoji: string };
type Message = {
  id: string;
  channel_id: string;
  author_id: string;
  content: string;
  parent_id: string | null;
  pinned_at: string | null;
  created_at: string;
  updated_at: string;
  community_members: { display_name: string } | { display_name: string }[] | null;
  reactions: Reaction[];
};
type ApiPayload = { messages?: Message[]; message?: Message; error?: string };
const emojis = ["👍", "❤️", "💪", "🎯", "🙏"];

function memberName(message: Message): string {
  const member = Array.isArray(message.community_members) ? message.community_members[0] : message.community_members;
  return member?.display_name ?? "Membre SkillFlow";
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function ChannelChat({ channelId, channelName, description, userId, isStaff }: {
  channelId: string;
  channelName: string;
  description: string;
  userId: string;
  isStaff: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const endpoint = `/api/community/channels/${channelId}/messages`;
  const loadMessages = useCallback(async (before?: string) => {
    const params = new URLSearchParams();
    if (before) params.set("before", before);
    if (searchQuery) params.set("q", searchQuery);
    const suffix = params.size ? `?${params.toString()}` : "";
    const response = await fetch(`${endpoint}${suffix}`, { cache: "no-store" });
    const payload = await response.json() as ApiPayload;
    if (!response.ok) throw new Error(payload.error ?? "Impossible de charger les messages.");
    return payload.messages ?? [];
  }, [endpoint, searchQuery]);

  const refresh = useCallback(async () => {
    try {
      const latest = await loadMessages();
      setMessages(latest);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de charger les messages.");
    } finally {
      setLoading(false);
    }
  }, [loadMessages]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    const client = getSupabaseClient();
    const subscription = client.channel(`community-messages-${channelId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` }, () => { void refresh(); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` }, () => { void refresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "reactions", filter: `channel_id=eq.${channelId}` }, () => { void refresh(); })
      .subscribe();
    return () => { window.clearTimeout(timer); void client.removeChannel(subscription); };
  }, [channelId, refresh]);

  const pinnedMessages = useMemo(() => messages.filter((message) => message.pinned_at), [messages]);
  const messageById = useMemo(() => new Map(messages.map((message) => [message.id, message])), [messages]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim() || pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft, parentId: replyTo?.id }),
      });
      const payload = await response.json() as ApiPayload;
      if (!response.ok) throw new Error(payload.error ?? "Le message n’a pas pu être envoyé.");
      setDraft("");
      setReplyTo(null);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Le message n’a pas pu être envoyé.");
    } finally {
      setPending(false);
    }
  }

  async function performAction(url: string, method: string, body?: object) {
    setError("");
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Action impossible.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action impossible.");
    }
  }

  async function loadOlder() {
    const oldest = messages[0];
    if (!oldest || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const older = await loadMessages(oldest.created_at);
      setMessages((current) => [...older, ...current]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de charger les anciens messages.");
    } finally {
      setLoadingOlder(false);
    }
  }

  async function saveEdit(messageId: string) {
    await performAction(`/api/community/messages/${messageId}`, "PATCH", { content: editDraft });
    setEditingId(null);
    setEditDraft("");
  }

  async function submitReport(event: FormEvent<HTMLFormElement>, messageId: string) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await performAction(`/api/community/messages/${messageId}/report`, "POST", { reason: form.get("reason") });
    formElement.reset();
  }

  return (
    <main className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="h-fit rounded-2xl border border-slate-700 bg-[#101a2b] p-5">
        <Link href="/community" className="text-sm font-semibold text-cyan-200 hover:text-white">← Tous les salons</Link>
        <h1 className="mt-5 text-xl font-bold text-white">{channelName}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
        <p className="mt-5 border-t border-slate-700 pt-4 text-xs leading-5 text-slate-400">Échangez avec respect. Pas de promesse de revenus, de pression ni de messages répétés.</p>
      </aside>

      <section aria-label={`Messages du salon ${channelName}`} className="min-w-0 rounded-2xl border border-slate-700 bg-[#101a2b]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 px-4 py-4 sm:px-6">
          <div><h2 className="font-bold text-white">Conversation</h2><p className="mt-1 text-xs text-slate-400">Les échanges sont visibles par les membres autorisés de ce salon.</p></div>
          <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200">En direct</span>
        </div>

        {pinnedMessages.length > 0 && <div className="border-b border-cyan-300/20 bg-cyan-300/[.06] px-4 py-4 sm:px-6"><p className="text-xs font-bold uppercase tracking-[.16em] text-cyan-200">Message épinglé</p>{pinnedMessages.map((message) => <p key={message.id} className="mt-2 text-sm leading-6 text-slate-200">{message.content}</p>)}</div>}
        {error && <p role="alert" className="mx-4 mt-4 rounded-xl border border-rose-300/30 bg-rose-300/10 p-3 text-sm text-rose-100 sm:mx-6">{error}</p>}

        <form onSubmit={(event) => { event.preventDefault(); setSearchQuery(searchDraft.trim()); }} className="flex flex-col gap-2 border-b border-slate-700 p-4 sm:flex-row sm:px-6">
          <label htmlFor="community-search" className="sr-only">Rechercher dans ce salon</label>
          <input id="community-search" type="search" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} maxLength={100} placeholder="Rechercher dans ce salon" className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-600 bg-[#0b1220] px-4 text-sm text-white placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" />
          <div className="flex gap-2"><button type="submit" disabled={searchDraft.trim().length === 1} className="min-h-11 rounded-xl bg-cyan-300 px-4 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">Rechercher</button>{searchQuery && <button type="button" onClick={() => { setSearchDraft(""); setSearchQuery(""); }} className="min-h-11 rounded-xl border border-slate-600 px-4 text-sm text-slate-200 hover:border-cyan-300">Effacer</button>}</div>
        </form>

        <div className="flex max-h-[65vh] min-h-[320px] flex-col gap-3 overflow-y-auto p-4 sm:p-6" aria-live="polite" aria-relevant="additions text">
          {!loading && messages.length > 0 && <button type="button" onClick={() => void loadOlder()} disabled={loadingOlder} className="mx-auto rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:border-cyan-300 disabled:opacity-50">{loadingOlder ? "Chargement…" : "Charger les messages précédents"}</button>}
          {loading ? <p className="m-auto text-sm text-slate-400">Chargement des messages…</p> : messages.length === 0 ? <p className="m-auto text-center text-sm text-slate-400">Aucun message pour l’instant. Lancez la conversation avec une question ou une idée.</p> : messages.map((message) => {
            const reactions = message.reactions ?? [];
            const parent = message.parent_id ? messageById.get(message.parent_id) : undefined;
            return (
              <article key={message.id} className={`max-w-3xl rounded-2xl border p-4 ${message.author_id === userId ? "self-end border-cyan-300/20 bg-cyan-300/[.07]" : "self-start border-slate-700 bg-[#0c1422]"}`}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400"><span className="font-bold text-cyan-200">{memberName(message)}</span><time dateTime={message.created_at}>{formatTime(message.created_at)}</time>{message.updated_at !== message.created_at && <span>(modifié)</span>}</div>
                {parent && <p className="mt-2 border-l-2 border-cyan-300/50 pl-3 text-xs text-slate-400">En réponse à {memberName(parent)} : {parent.content.slice(0, 100)}</p>}
                {editingId === message.id ? <div className="mt-3 grid gap-2"><textarea value={editDraft} onChange={(event) => setEditDraft(event.target.value)} maxLength={4000} rows={3} aria-label="Modifier le message" className="w-full rounded-xl border border-slate-600 bg-[#080e19] p-3 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"/><div className="flex gap-2"><button type="button" onClick={() => void saveEdit(message.id)} className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-bold text-slate-950">Enregistrer</button><button type="button" onClick={() => setEditingId(null)} className="rounded-full border border-slate-600 px-4 py-2 text-xs text-slate-200">Annuler</button></div></div> : <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-100">{message.content}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {emojis.map((emoji) => { const matching = reactions.filter((reaction) => reaction.emoji === emoji); return <button key={emoji} type="button" onClick={() => void performAction(`/api/community/messages/${message.id}/reactions`, "POST", { emoji })} aria-label={`Réagir ${emoji}; ${matching.length} réaction(s)`} className={`rounded-full border px-2.5 py-1 text-xs ${matching.some((reaction) => reaction.user_id === userId) ? "border-cyan-300/50 bg-cyan-300/10 text-white" : "border-slate-700 text-slate-300 hover:border-cyan-300/40"}`}>{emoji} {matching.length || ""}</button>; })}
                  <button type="button" onClick={() => setReplyTo(message)} className="rounded-full px-2 py-1 text-xs font-semibold text-cyan-200 hover:bg-cyan-300/10">Répondre</button>
                  {message.author_id === userId && editingId !== message.id && <button type="button" onClick={() => { setEditingId(message.id); setEditDraft(message.content); }} className="rounded-full px-2 py-1 text-xs text-slate-300 hover:bg-white/5">Modifier</button>}
                  {(message.author_id === userId || isStaff) && <button type="button" onClick={() => void performAction(`/api/community/messages/${message.id}`, "DELETE")} className="rounded-full px-2 py-1 text-xs text-slate-300 hover:bg-rose-300/10 hover:text-rose-200">Supprimer</button>}
                  {isStaff && <button type="button" onClick={() => void performAction(`/api/community/messages/${message.id}/pin`, "POST", { pinned: !message.pinned_at })} className="rounded-full px-2 py-1 text-xs text-slate-300 hover:bg-cyan-300/10">{message.pinned_at ? "Désépingler" : "Épingler"}</button>}
                  <details className="relative"><summary className="cursor-pointer list-none rounded-full px-2 py-1 text-xs text-slate-400 hover:bg-white/5">Signaler</summary><form onSubmit={(event) => void submitReport(event, message.id)} className="absolute right-0 z-10 mt-2 w-72 rounded-xl border border-slate-600 bg-[#0b1220] p-3 shadow-xl"><label className="grid gap-2 text-xs font-semibold text-slate-200">Motif du signalement<textarea name="reason" required minLength={3} maxLength={500} rows={3} className="rounded-lg border border-slate-600 bg-[#101a2b] p-2 text-sm font-normal text-white"/></label><button className="mt-2 rounded-full bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-950">Envoyer le signalement</button></form></details>
                </div>
              </article>
            );
          })}
        </div>

        <form onSubmit={(event) => void sendMessage(event)} className="border-t border-slate-700 p-4 sm:p-6">
          {replyTo && <div className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-cyan-300/[.06] px-3 py-2 text-xs text-cyan-100"><span>Réponse à {memberName(replyTo)} : {replyTo.content.slice(0, 90)}</span><button type="button" onClick={() => setReplyTo(null)} aria-label="Annuler la réponse" className="text-white">×</button></div>}
          <label htmlFor="community-message" className="sr-only">Votre message</label>
          <textarea id="community-message" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={4000} rows={3} placeholder="Écrivez un message…" className="w-full resize-y rounded-xl border border-slate-600 bg-[#0b1220] p-4 text-sm leading-6 text-white placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-400">Maximum 4 000 caractères · un message identique ne peut pas être renvoyé immédiatement.</p><button type="submit" disabled={pending || !draft.trim()} className="rounded-full bg-cyan-300 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Envoi…" : "Envoyer"}</button></div>
        </form>
      </section>
    </main>
  );
}
