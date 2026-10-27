import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { ElectricLogo } from "@/components/electric-icons";

const accountBenefits = [
  { icon: "↗", title: "Retrouvez vos skills", detail: "Vos achats et téléchargements au même endroit." },
  { icon: "✳", title: "Connectez votre assistant", detail: "Configurez votre clé personnelle pour utiliser le MCP." },
  { icon: "◇", title: "Gardez le contrôle", detail: "Gérez vos accès depuis votre espace client." },
];

export default function LoginPage() {
  return (
    <main className="auth-page relative isolate flex min-h-[100svh] items-center overflow-hidden px-4 py-10 sm:px-8 sm:py-14 lg:px-10">
      <div className="auth-grid pointer-events-none absolute inset-0 -z-20" />
      <div className="auth-orb auth-orb-one pointer-events-none absolute -left-40 -top-48 -z-10 h-[35rem] w-[35rem] rounded-full bg-cyan-400/15 blur-[100px]" />
      <div className="auth-orb auth-orb-two pointer-events-none absolute -bottom-64 right-[-10rem] -z-10 h-[42rem] w-[42rem] rounded-full bg-blue-600/15 blur-[120px]" />

      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
        <section className="auth-copy animate-rise mx-auto w-full max-w-xl lg:mx-0">
          <Link href="/" className="site-logo inline-flex items-center rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200">
            <ElectricLogo />
          </Link>

          <div className="mt-12 sm:mt-16">
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.07] px-3.5 py-2 text-xs font-semibold text-cyan-100">
              <span className="text-base text-cyan-200">✦</span>
              Des skills IA pour le travail réel
            </p>
            <h1 className="mt-6 max-w-xl font-[family-name:var(--font-bricolage)] text-4xl font-semibold leading-[1.05] tracking-[-0.05em] text-white sm:text-5xl lg:text-[3.6rem]">
              Boostez votre IA avec les bonnes
              <span className="hero-gradient block pb-2">compétences.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
              Accédez à votre espace pour gérer vos skills, retrouver vos fichiers et connecter votre assistant.
            </p>
          </div>

          <div className="mt-9 space-y-5">
            {accountBenefits.map((benefit, index) => (
              <div key={benefit.title} className="animate-rise flex items-center gap-3.5" style={{ animationDelay: `${0.12 + index * 0.1}s` }}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.07] text-lg text-cyan-200 shadow-[0_0_22px_rgba(34,211,238,0.08)]">{benefit.icon}</span>
                <div>
                  <h2 className="text-sm font-semibold text-white">{benefit.title}</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-400 sm:text-sm">{benefit.detail}</p>
                </div>
              </div>
            ))}
          </div>

          <BackLink href="/" className="mt-10">Retour à SkillFlow</BackLink>
        </section>

        <div className="animate-rise animate-delay-2 mx-auto w-full max-w-[34rem] lg:mx-0 lg:justify-self-end">
          <Suspense fallback={<div className="min-h-[32rem] animate-pulse rounded-[1.75rem] border border-white/10 bg-white/[0.03]" aria-label="Chargement du formulaire" />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
