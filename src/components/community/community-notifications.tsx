"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

type CommunityNotification = {
  id: string;
  kind: "reply" | "mention" | "dm";
  actor_name: string;
  channel_name: string;
  channel_id: string;
  excerpt: string;
  created_at: string;
  read_at: string | null;
};

type NotificationsPayload = { notifications?: CommunityNotification[]; unreadCount?: number; error?: string };

function notificationLabel(kind: CommunityNotification["kind"]) {
  if (kind === "mention") return "t’a mentionné dans";
  if (kind === "dm") return "t’a écrit";
  return "a répondu dans";
}

export function CommunityNotifications({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<CommunityNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/community/notifications", { cache: "no-store" });
      const payload = await response.json() as NotificationsPayload;
      if (!response.ok) throw new Error(payload.error ?? "Notifications indisponibles.");
      setNotifications(payload.notifications ?? []);
      setUnreadCount(payload.unreadCount ?? 0);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Notifications indisponibles.");
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => { void load(); }, 0);
    const client = getSupabaseClient();
    const channel = client.channel(`community-notifications-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_notifications", filter: `user_id=eq.${userId}` }, () => { void load(); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "community_notifications", filter: `user_id=eq.${userId}` }, () => { void load(); })
      .subscribe();
    const refresh = window.setInterval(() => { void load(); }, 60_000);
    return () => { window.clearTimeout(initial); window.clearInterval(refresh); void client.removeChannel(channel); };
  }, [load, userId]);

  async function markRead(id?: string) {
    const response = await fetch("/api/community/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id } : {}),
    });
    if (!response.ok) {
      const payload = await response.json() as { error?: string };
      setError(payload.error ?? "Impossible de mettre à jour les notifications.");
      return;
    }
    await load();
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={`Notifications${unreadCount ? `, ${unreadCount} non lue(s)` : ""}`} className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-700 text-cyan-100 transition hover:border-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
        {unreadCount > 0 && <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-cyan-300 px-1 text-[10px] font-bold text-slate-950">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>
      {open && <section aria-label="Vos notifications" className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-slate-700 bg-[#0b1220] p-3 shadow-2xl">
        <div className="flex items-center justify-between gap-2 px-2 py-1"><h2 className="font-semibold text-white">Notifications</h2>{unreadCount > 0 && <button type="button" onClick={() => void markRead()} className="text-xs font-semibold text-cyan-200 hover:text-white">Tout marquer comme lu</button>}</div>
        {error && <p role="alert" className="mt-2 rounded-xl bg-rose-300/10 p-2 text-xs text-rose-100">{error}</p>}
        <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto">{notifications.length ? notifications.map((notification) => <li key={notification.id}><Link href={notification.kind === "dm" ? "/community/messages" : `/community/channels/${notification.channel_id}`} onClick={() => { if (!notification.read_at) void markRead(notification.id); setOpen(false); }} className={`block rounded-xl p-3 transition hover:bg-white/[.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 ${notification.read_at ? "text-slate-300" : "bg-cyan-300/[.06] text-white"}`}><span className="block text-xs text-cyan-200">{notification.actor_name} {notificationLabel(notification.kind)} {notification.kind === "dm" ? "" : notification.channel_name}</span><span className="mt-1 block break-words text-sm">{notification.excerpt || "Ouvrir la conversation"}</span><time className="mt-1 block text-[11px] text-slate-500" dateTime={notification.created_at}>{new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(notification.created_at))}</time></Link></li>) : <li className="px-3 py-8 text-center text-sm text-slate-400">Aucune notification pour le moment.</li>}</ul>
      </section>}
    </div>
  );
}
