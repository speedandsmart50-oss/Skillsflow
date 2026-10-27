"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";

export type AuthStatus = "loading" | "authenticated" | "anonymous";
type AuthSessionContextValue = { status: AuthStatus; user: User | null };
const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({ children, initialUser }: { children: React.ReactNode; initialUser?: { id: string; email?: string } | null }) {
  const [user, setUser] = useState<User | null>(() => initialUser ? ({ id: initialUser.id, email: initialUser.email ?? "" } as User) : null);
  const [status, setStatus] = useState<AuthStatus>(initialUser ? "authenticated" : "loading");

  useEffect(() => {
    const supabase = getSupabaseClient();
    let active = true;
    const verifyUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;
      const nextUser = error ? null : data.user;
      setUser(nextUser);
      setStatus(nextUser ? "authenticated" : "anonymous");
    };

    void verifyUser();
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      if (!active) return;
      window.setTimeout(() => void verifyUser(), 0);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ status, user }), [status, user]);
  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const value = useContext(AuthSessionContext);
  if (!value) throw new Error("Le fournisseur de session n'est pas disponible.");
  return value;
}
