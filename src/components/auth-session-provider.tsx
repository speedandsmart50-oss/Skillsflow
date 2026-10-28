"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";

export type AuthStatus = "loading" | "authenticated" | "anonymous";
type AuthSessionContextValue = { status: AuthStatus; user: User | null };
const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

// A user must actively use the platform at least once every 30 minutes.
// The timestamp is deliberately device-local and never contains personal data.
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const LAST_ACTIVITY_STORAGE_KEY = "skillsflow.lastAuthenticatedActivityAt";

export function AuthSessionProvider({ children, initialUser }: { children: React.ReactNode; initialUser?: { id: string; email?: string } | null }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(() => initialUser ? ({ id: initialUser.id, email: initialUser.email ?? "" } as User) : null);
  const [status, setStatus] = useState<AuthStatus>(initialUser ? "authenticated" : "loading");
  const idleTimer = useRef<number | null>(null);
  const isEndingIdleSession = useRef(false);

  useEffect(() => {
    const supabase = getSupabaseClient();
    let active = true;
    let sessionActive = false;
    let lastActivityRecordedAt = 0;

    const clearIdleTimer = () => {
      if (idleTimer.current !== null) {
        window.clearTimeout(idleTimer.current);
        idleTimer.current = null;
      }
    };

    const clearLastActivity = () => {
      try {
        window.localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
      } catch {
        // Private browsing can block local storage. The current tab timer still protects the session.
      }
    };

    const readLastActivity = () => {
      try {
        const value = Number(window.localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY));
        return Number.isFinite(value) && value > 0 ? value : Date.now();
      } catch {
        return Date.now();
      }
    };

    const writeLastActivity = () => {
      try {
        window.localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(Date.now()));
      } catch {
        // Keep the in-memory timer when persistent storage is unavailable.
      }
    };

    const redirectToReauthentication = () => {
      const nextPath = `${window.location.pathname}${window.location.search}`;
      router.replace(`/login?next=${encodeURIComponent(nextPath)}&reason=idle`);
      router.refresh();
    };

    const endIdleSession = async () => {
      if (!active || isEndingIdleSession.current) return;
      isEndingIdleSession.current = true;
      sessionActive = false;
      clearIdleTimer();
      clearLastActivity();
      setUser(null);
      setStatus("anonymous");

      // A local sign-out reliably removes this browser's credentials, including
      // when the network is unavailable. Server routes still reject requests
      // without a valid Supabase token.
      try {
        await supabase.auth.signOut({ scope: "local" });
      } finally {
        if (active) redirectToReauthentication();
      }
    };

    const scheduleIdleTimeout = () => {
      clearIdleTimer();
      const remaining = Math.max(0, readLastActivity() + IDLE_TIMEOUT_MS - Date.now());
      idleTimer.current = window.setTimeout(() => void endIdleSession(), remaining);
    };

    const recordActivity = () => {
      if (!active || !sessionActive || isEndingIdleSession.current) return;
      const now = Date.now();
      if (now - lastActivityRecordedAt < 1000) return;
      lastActivityRecordedAt = now;
      writeLastActivity();
      scheduleIdleTimeout();
    };

    const verifyUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;
      const nextUser = error ? null : data.user;
      sessionActive = Boolean(nextUser);
      setUser(nextUser);
      setStatus(nextUser ? "authenticated" : "anonymous");
      if (nextUser) {
        scheduleIdleTimeout();
      } else {
        clearIdleTimer();
        clearLastActivity();
      }
    };

    void verifyUser();
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      // Supabase emits SIGNED_OUT as soon as the local session is removed.
      // Update the shared source of truth from that event instead of waiting for
      // a follow-up request, so public navigation immediately shows its actions.
      const nextUser = session?.user ?? null;
      sessionActive = Boolean(nextUser);
      setUser(nextUser);
      setStatus(nextUser ? "authenticated" : "anonymous");

      if (!nextUser || event === "SIGNED_OUT") {
        clearIdleTimer();
        clearLastActivity();
        return;
      }

      if (event === "SIGNED_IN") {
        isEndingIdleSession.current = false;
        writeLastActivity();
      }
      scheduleIdleTimeout();
    });

    const activityEvents: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart", "scroll"];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true }));
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") recordActivity();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      clearIdleTimer();
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, recordActivity));
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      subscription.subscription.unsubscribe();
    };
  }, [router]);

  const value = useMemo(() => ({ status, user }), [status, user]);
  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const value = useContext(AuthSessionContext);
  if (!value) throw new Error("Le fournisseur de session n'est pas disponible.");
  return value;
}
