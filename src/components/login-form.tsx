"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/security/redirect";

function MailIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="10" width="16" height="11" rx="2.5" />
      <path d="M8 10V7a4 4 0 1 1 8 0v3" />
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const idleSessionExpired = searchParams.get("reason") === "idle";
  const [mode, setMode] = useState<"signin" | "signup">(() => searchParams.get("mode") === "signup" ? "signup" : "signin");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  async function handleGoogleSignIn() {
    setError("");
    setMessage("");
    setPending(true);
    try {
      const redirectTo = new URL("/auth/callback", window.location.origin);
      redirectTo.searchParams.set("next", nextPath);
      const { error: oauthError } = await getSupabaseClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectTo.toString() },
      });
      if (oauthError) throw oauthError;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Connexion Google impossible.");
      setPending(false);
    }
  }

  async function handlePasswordReset() {
    setError("");
    setMessage("");
    const emailInput = document.querySelector<HTMLInputElement>("#email");
    const email = emailInput?.value.trim();
    if (!email) {
      setError("Saisissez votre adresse e-mail pour recevoir le lien de récupération.");
      emailInput?.focus();
      return;
    }
    setPending(true);
    try {
      const redirectTo = new URL("/auth/callback", window.location.origin);
      redirectTo.searchParams.set("next", "/auth/reset-password");
      const { error: resetError } = await getSupabaseClient().auth.resetPasswordForEmail(email, { redirectTo: redirectTo.toString() });
      if (resetError) throw resetError;
      setMessage("Si cette adresse est associée à un compte, un lien de récupération vient d’être envoyé.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible d’envoyer le lien de récupération.");
    } finally {
      setPending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setPending(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    try {
      const supabase = getSupabaseClient();
      const result =
        mode === "signup"
          ? await supabase.auth.signUp({ email, password })
          : await supabase.auth.signInWithPassword({ email, password });

      if (result.error) {
        setError(result.error.message);
        return;
      }

      if (mode === "signup" && !result.data.session) {
        setMessage("Compte créé. Consultez votre boîte mail pour confirmer l’adresse, puis connectez-vous.");
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Connexion impossible.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="auth-form-title" className="auth-form-card rounded-[1.75rem] border border-cyan-300/20 bg-[#0d1729]/90 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.38)] backdrop-blur-xl sm:p-9">
      <div className="mb-8">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.08] text-xl text-cyan-200 sm:hidden">✦</div>
        <h2 id="auth-form-title" className="font-[family-name:var(--font-bricolage)] text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
          {resetMode ? "Récupérer mon compte" : mode === "signin" ? "Connexion" : "Créer un compte"}
        </h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-slate-300 sm:text-base">
          {mode === "signin"
            ? idleSessionExpired
              ? "Votre session a été fermée après 30 minutes sans activité. Reconnectez-vous pour reprendre en toute sécurité."
              : "Accédez à votre espace pour gérer vos skills et retrouver vos téléchargements."
            : "Inscrivez-vous avec votre e-mail et un mot de passe, ou continuez avec Google."}
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email" className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
            <MailIcon /> E-mail
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-500"><MailIcon /></span>
            <input
              id="email"
              name="email"
              autoComplete="email"
              required
              type="email"
              placeholder="vous@email.com"
              className="auth-input min-h-[3.35rem] w-full rounded-2xl border border-[#28425f] bg-[#0a1423]/80 py-3 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/80 focus:ring-4 focus:ring-cyan-300/10"
            />
          </div>
        </div>

        {!resetMode && <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="password" className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <LockIcon /> Mot de passe
            </label>
          </div>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-500"><LockIcon /></span>
            <input
              id="password"
              name="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={8}
              type={showPassword ? "text" : "password"}
              placeholder="Au moins 8 caractères"
              className="auth-input min-h-[3.35rem] w-full rounded-2xl border border-[#28425f] bg-[#0a1423]/80 py-3 pl-12 pr-20 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/80 focus:ring-4 focus:ring-cyan-300/10"
            />
            <button
              type="button"
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute inset-y-0 right-3 my-auto h-9 rounded-lg px-2 text-xs font-medium text-cyan-200 transition hover:bg-white/[0.05] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200"
            >
              {showPassword ? "Masquer" : "Afficher"}
            </button>
          </div>
          {mode === "signin" && !resetMode && <button type="button" onClick={() => { setResetMode(true); setError(""); setMessage(""); }} className="mt-3 text-xs font-medium text-cyan-200 underline underline-offset-4">Mot de passe oublié ?</button>}
        </div>}

        {error && (
          <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200">{error}</p>
        )}

        {message && (
          <p role="status" className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.07] px-4 py-3 text-sm leading-6 text-emerald-100">{message}</p>
        )}

        {resetMode ? <button disabled={pending} type="button" onClick={() => void handlePasswordReset()} className="group mt-2 inline-flex min-h-[3.35rem] w-full items-center justify-center rounded-full bg-gradient-to-r from-cyan-300 to-cyan-400 px-5 py-3 text-sm font-bold text-[#07111e] disabled:opacity-60">{pending ? "Patientez…" : "Recevoir un lien de récupération"}</button> : <button
          disabled={pending}
          type="submit"
          className="group mt-2 inline-flex min-h-[3.35rem] w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-300 to-cyan-400 px-5 py-3 text-sm font-bold text-[#07111e] shadow-[0_8px_30px_rgba(34,211,238,0.18)] transition duration-300 hover:-translate-y-0.5 hover:from-cyan-200 hover:to-cyan-300 hover:shadow-[0_12px_38px_rgba(34,211,238,0.28)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-100 disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Patientez…" : mode === "signin" ? idleSessionExpired ? "Se reconnecter" : "Se connecter" : "Créer mon compte"}
          {!pending && <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>}
        </button>}
      </form>

      {!resetMode && <>
        <div className="my-6 flex items-center gap-3 text-[11px] text-slate-500"><span className="h-px flex-1 bg-white/10" />OU<span className="h-px flex-1 bg-white/10" /></div>
        <button type="button" disabled={pending} onClick={() => void handleGoogleSignIn()} className="inline-flex min-h-[3.35rem] w-full items-center justify-center gap-3 rounded-full border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.09] disabled:opacity-60">
          <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.72 7.18l7.24 5.62c4.22-3.89 6.52-9.62 6.52-17.27Z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-6.18l-7.24-5.62c-2.01 1.35-4.59 2.15-8.66 2.15-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>
          Continuer avec Google
        </button>
      </>}

      <div className="my-6 flex items-center gap-3 text-[11px] text-slate-500">
        <span className="h-px flex-1 bg-white/10" />
        Votre espace Skillsflow
        <span className="h-px flex-1 bg-white/10" />
      </div>

      {resetMode ? <p className="text-center text-sm text-slate-400">Vous vous souvenez de votre mot de passe ? <button type="button" className="font-semibold text-cyan-200 underline" onClick={() => { setResetMode(false); setError(""); setMessage(""); }}>Retour à la connexion</button></p> : <p className="text-center text-sm text-slate-400">
        {mode === "signin" ? "Vous n’avez pas encore de compte ?" : "Vous avez déjà un compte ?"}{" "}
        <button
          type="button"
          className="font-semibold text-cyan-200 underline decoration-cyan-200/30 underline-offset-4 transition hover:text-white hover:decoration-white"
          onClick={() => {
            setError("");
            setMessage("");
            setMode(mode === "signin" ? "signup" : "signin");
          }}
        >
          {mode === "signin" ? "Créer un compte" : "Se connecter"}
        </button>
      </p>}
    </section>
  );
}
