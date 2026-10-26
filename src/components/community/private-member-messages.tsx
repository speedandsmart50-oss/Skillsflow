"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

type Peer = { user_id: string; display_name: string; community_id: string };
type Thread = { id: string; user_one: string; user_two: string; created_at: string };
type Message = { id: string; author_id: string; content: string; created_at: string };
const inputClass = "min-h-12 w-full rounded-xl border border-[#29425D] bg-[#07111F] px-4 py-3 text-sm text-white outline-none placeholder:text-[#71849A] focus:border-[#20DDF2] focus:ring-2 focus:ring-[#20DDF2]/15";

export function PrivateMemberMessages({ userId }: { userId: string }) {
  const search = useSearchParams();
  const initialPeer = search.get("peer");
  const [peers, setPeers] = useState<Peer[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const load = useCallback(async (threadId?: string) => {
    const response = await fetch(`/api/community/private-messages${threadId ? `?thread=${threadId}` : ""}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) { setError(data.error ?? "Impossible de charger les messages."); return; }
    setPeers(data.peers ?? []); setThreads(data.threads ?? []); setMessages(data.messages ?? []);
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => {
    if (!initialPeer || selected || !peers.some((peer) => peer.user_id === initialPeer)) return;
    void startThread(initialPeer);
  // La sélection automatique ne doit se déclencher qu'après le chargement initial.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPeer, peers, selected]);
  useEffect(() => { if (!selected) return; const initial = window.setTimeout(() => void load(selected), 0); const timer = window.setInterval(() => void load(selected), 6000); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, [selected, load]);

  const activeThread = threads.find((thread) => thread.id === selected);
  const peerId = activeThread ? activeThread.user_one === userId ? activeThread.user_two : activeThread.user_one : "";
  const peer = peers.find((item) => item.user_id === peerId);
  const threadPeers = useMemo(() => threads.map((thread) => ({ thread, peerId: thread.user_one === userId ? thread.user_two : thread.user_one })), [threads, userId]);

  async function startThread(userId: string) {
    setPending(true); setError("");
    try {
      const response = await fetch("/api/community/private-messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start", peerId: userId }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Impossible de démarrer la conversation.");
      setSelected(data.threadId); await load(data.threadId);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Une erreur est survenue."); }
    finally { setPending(false); }
  }
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!content.trim() || !selected) return;
    setPending(true); setError("");
    try {
      const response = await fetch("/api/community/private-messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send", threadId: selected, content }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Impossible d’envoyer le message.");
      setContent(""); await load(selected);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Une erreur est survenue."); }
    finally { setPending(false); }
  }

  return <main className="animate-rise space-y-6 pb-10">
    <section className="rounded-2xl border border-[#203650] bg-[radial-gradient(ellipse_at_90%_0%,rgba(32,221,242,.09),transparent_45%),#0B1729] p-6 sm:p-8"><p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#70E9F5]">Entre membres</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Messages privés</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#A8B7CB]">Échangez en privé avec les personnes qui partagent au moins une communauté avec vous.</p></section>
    {error && <p role="alert" className="rounded-xl border border-rose-300/25 bg-rose-300/[.07] p-4 text-sm text-rose-100">{error}</p>}
    <section className="grid min-h-[560px] overflow-hidden rounded-2xl border border-[#203650] bg-[#0B1729] lg:grid-cols-[290px_minmax(0,1fr)]">
      <aside className="border-b border-[#203650] p-4 lg:border-b-0 lg:border-r"><h2 className="px-2 text-xs font-bold uppercase tracking-[.14em] text-[#91A4B9]">Conversations</h2><div className="mt-3 space-y-1">{threadPeers.map(({ thread, peerId }) => { const person = peers.find((item) => item.user_id === peerId); return <button key={thread.id} type="button" onClick={() => setSelected(thread.id)} className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left transition ${selected === thread.id ? "bg-[#20DDF2]/[.09] ring-1 ring-[#20DDF2]/25" : "hover:bg-white/[.04]"}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#17374A] text-sm font-bold text-[#70E9F5]">{person?.display_name.slice(0, 1).toUpperCase() ?? "M"}</span><span className="truncate text-sm font-semibold text-[#E3EBF4]">{person?.display_name ?? "Membre"}</span></button>; })}</div>
        <h2 className="mt-6 px-2 text-xs font-bold uppercase tracking-[.14em] text-[#91A4B9]">Membres de mes communautés</h2><div className="mt-3 space-y-1">{peers.length ? peers.map((person) => <button key={person.user_id} type="button" disabled={pending} onClick={() => void startThread(person.user_id)} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left transition hover:bg-white/[.04] disabled:opacity-50"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#29425D] text-xs font-bold text-[#A8B7CB]">{person.display_name.slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1 truncate text-sm text-[#C5D3E2]">{person.display_name}</span><span className="text-xs text-[#70E9F5]">Écrire</span></button>) : <p className="rounded-xl border border-dashed border-[#29425D] p-3 text-xs leading-5 text-[#91A4B9]">Rejoignez ou créez une communauté pour échanger avec ses membres.</p>}</div>
      </aside>
      <div className="flex min-h-[430px] flex-col">{selected ? <><header className="flex items-center gap-3 border-b border-[#203650] px-5 py-4"><span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[#20DDF2] to-[#5378F5] font-bold text-[#07111F]">{peer?.display_name.slice(0, 1).toUpperCase() ?? "M"}</span><div><h2 className="font-bold text-white">{peer?.display_name ?? "Conversation privée"}</h2><p className="text-xs text-[#91A4B9]">Échange privé</p></div></header><div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">{messages.length ? messages.map((message) => <article key={message.id} className={`w-fit max-w-[85%] rounded-2xl border p-3.5 ${message.author_id === userId ? "ml-auto border-[#20DDF2]/25 bg-[#0B2635]" : "border-[#203650] bg-[#0E1D32]"}`}><p className="whitespace-pre-wrap break-words text-sm leading-6 text-[#E3EBF4]">{message.content}</p><time className="mt-1 block text-right text-[10px] text-[#71849A]">{new Date(message.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</time></article>) : <div className="grid min-h-60 place-items-center text-center"><p className="text-sm text-[#91A4B9]">Démarrez la conversation par un message simple et respectueux.</p></div>}</div><form onSubmit={(event) => void send(event)} className="flex gap-2 border-t border-[#203650] p-3 sm:p-4"><label className="sr-only" htmlFor="private-message">Votre message privé</label><input id="private-message" value={content} maxLength={4000} onChange={(event) => setContent(event.target.value)} placeholder="Écrire un message privé…" className={inputClass} /><button disabled={pending || !content.trim()} className="min-h-12 rounded-xl bg-[#20DDF2] px-5 text-sm font-bold text-[#06131F] transition hover:bg-[#70E9F5] disabled:opacity-50">Envoyer</button></form></> : <div className="grid flex-1 place-items-center p-8 text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-[#20DDF2]/20 bg-[#20DDF2]/[.06] text-2xl text-[#70E9F5]">✉</span><h2 className="mt-4 text-lg font-bold text-white">Choisissez un membre</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#91A4B9]">Vos messages sont privés et accessibles uniquement aux deux personnes de la conversation.</p></div></div>}</div>
    </section>
  </main>;
}
