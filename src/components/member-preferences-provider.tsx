"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

export type DashboardTheme = "midnight" | "ocean" | "violet" | "light";
export type MemberProfile = { displayName: string; email: string; avatarUrl: string | null; theme: DashboardTheme };
type PreferencesContextValue = {
  profile: MemberProfile | null;
  loading: boolean;
  saveProfile: (input: { displayName: string; theme: DashboardTheme }) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  removeAvatar: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);
const themes: DashboardTheme[] = ["midnight", "ocean", "violet", "light"];

export function useMemberPreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("Les préférences membre ne sont pas disponibles.");
  return value;
}

export function MemberPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const { data, error } = await getSupabaseClient().auth.getSession();
    if (error) throw error;
    if (!data.session) throw new Error("Reconnectez-vous pour modifier votre profil.");
    const response = await fetch(path, {
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: `Bearer ${data.session.access_token}` },
      cache: "no-store",
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
        ? payload.error : "Impossible d’enregistrer vos préférences.";
      throw new Error(message);
    }
    return payload as Record<string, unknown>;
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const payload = await request("/api/account/profile");
      if (typeof payload.profile !== "object" || payload.profile === null) return;
      const value = payload.profile as Record<string, unknown>;
      setProfile({
        displayName: typeof value.displayName === "string" ? value.displayName : "",
        email: typeof value.email === "string" ? value.email : "",
        avatarUrl: typeof value.avatarUrl === "string" ? value.avatarUrl : null,
        theme: themes.includes(value.theme as DashboardTheme) ? value.theme as DashboardTheme : "midnight",
      });
    } catch {
      // The rest of the member area remains usable if preferences are temporarily unavailable.
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refreshProfile(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshProfile]);

  const saveProfile = useCallback(async (input: { displayName: string; theme: DashboardTheme }) => {
    const payload = await request("/api/account/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    if (typeof payload.profile !== "object" || payload.profile === null) throw new Error("Réponse de profil invalide.");
    const value = payload.profile as Record<string, unknown>;
    setProfile((current) => ({
      displayName: typeof value.displayName === "string" ? value.displayName : input.displayName,
      email: current?.email ?? "",
      avatarUrl: current?.avatarUrl ?? null,
      theme: themes.includes(value.theme as DashboardTheme) ? value.theme as DashboardTheme : input.theme,
    }));
  }, [request]);

  const uploadAvatar = useCallback(async (file: File) => {
    const body = new FormData();
    body.set("avatar", file);
    await request("/api/account/profile/avatar", { method: "POST", body });
    await refreshProfile();
  }, [refreshProfile, request]);

  const removeAvatar = useCallback(async () => {
    await request("/api/account/profile/avatar", { method: "DELETE" });
    await refreshProfile();
  }, [refreshProfile, request]);

  const contextValue = useMemo(() => ({ profile, loading, saveProfile, uploadAvatar, removeAvatar, refreshProfile }), [profile, loading, saveProfile, uploadAvatar, removeAvatar, refreshProfile]);
  return <PreferencesContext.Provider value={contextValue}>
    <div className="member-preferences-scope" data-member-theme={profile?.theme ?? "midnight"}>{children}</div>
  </PreferencesContext.Provider>;
}
