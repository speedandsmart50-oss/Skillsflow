"use client";

import { useEffect, useRef, useState } from "react";

const examples = [
  {
    id: "invitation",
    label: "Inviter",
    eyebrow: "Créer un premier contact",
    prompt: "Je veux proposer une présentation à une amie, sans lui mettre la pression.",
    answer: "Commence par demander si le sujet l’intéresse, puis explique en une phrase pourquoi tu as pensé à elle. Laisse-lui une vraie possibilité de dire non.",
    tag: "Ton naturel",
  },
  {
    id: "relance",
    label: "Relancer",
    eyebrow: "Faire un suivi respectueux",
    prompt: "Elle a vu mon message mais n’a pas répondu. Que lui écrire ?",
    answer: "Envoie un seul message bref qui lui laisse le choix : « Je reviens vers toi une dernière fois. Si ce n’est pas le bon moment, aucun souci. »",
    tag: "Sans insistance",
  },
  {
    id: "decision",
    label: "Décider",
    eyebrow: "Répondre avec transparence",
    prompt: "Il hésite à cause du coût et veut réfléchir.",
    answer: "Clarifie les frais réels et les efforts nécessaires, sans promettre de résultat. Puis demande-lui s’il préfère commencer, attendre ou laisser tomber.",
    tag: "Réponse honnête",
  },
];

export function AnimatedShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const showcaseRef = useRef<HTMLDivElement>(null);
  const activeExample = examples[activeIndex];

  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setReducedMotion(motionPreference.matches);
    updateMotionPreference();
    motionPreference.addEventListener("change", updateMotionPreference);

    const element = showcaseRef.current;
    if (!element) {
      return () => motionPreference.removeEventListener("change", updateMotionPreference);
    }
    if (!("IntersectionObserver" in window)) {
      return () => motionPreference.removeEventListener("change", updateMotionPreference);
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.2 },
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
      motionPreference.removeEventListener("change", updateMotionPreference);
    };
  }, []);

  useEffect(() => {
    if (!isPlaying || !isVisible || reducedMotion) return;
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % examples.length);
    }, 5200);
    return () => window.clearInterval(interval);
  }, [isPlaying, isVisible, reducedMotion]);

  return (
    <div ref={showcaseRef} className="animate-rise animate-delay-2 relative mx-auto w-full max-w-[34rem] lg:mr-0">
      <div className="animate-glow animate-float pointer-events-none absolute -inset-5 rounded-[2.5rem] bg-gradient-to-br from-cyan-300/20 via-blue-500/10 to-violet-400/20 blur-2xl" />
      <div className="relative rounded-[1.75rem] border border-white/[0.12] bg-[#111a2c]/90 p-4 shadow-[0_35px_100px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:p-6">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-200 to-blue-400 text-lg font-black text-slate-950">S</span>
            <div>
              <p className="text-sm font-semibold text-white">Votre espace de travail IA</p>
              <p className="mt-0.5 text-xs text-slate-500">SkillFlow · aperçu interactif</p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-cyan-300/15 bg-cyan-300/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-100">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> Démo
          </span>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Exemples d’utilisation du skill">
            {examples.map((example, index) => (
              <button
                key={example.id}
                type="button"
                role="tab"
                aria-selected={activeIndex === index}
                tabIndex={activeIndex === index ? 0 : -1}
                aria-controls="skillflow-demo-panel"
                id={`skillflow-demo-tab-${example.id}`}
                onClick={() => setActiveIndex(index)}
                onKeyDown={(event) => {
                  const key = event.key;
                  const nextIndex = key === "ArrowRight" || key === "ArrowDown"
                    ? (index + 1) % examples.length
                    : key === "ArrowLeft" || key === "ArrowUp"
                      ? (index - 1 + examples.length) % examples.length
                      : key === "Home"
                        ? 0
                        : key === "End"
                          ? examples.length - 1
                          : null;
                  if (nextIndex === null) return;
                  event.preventDefault();
                  setActiveIndex(nextIndex);
                  event.currentTarget.parentElement
                    ?.querySelectorAll<HTMLButtonElement>("[role='tab']")[nextIndex]
                    ?.focus();
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 ${activeIndex === index ? "bg-cyan-300 text-[#07111e] shadow-[0_0_20px_rgba(34,211,238,0.22)]" : "border border-white/10 text-slate-400 hover:border-cyan-200/30 hover:text-white"}`}
              >
                {example.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setIsPlaying((playing) => !playing)}
            aria-pressed={!isPlaying}
            aria-label={isPlaying ? "Mettre en pause la démo automatique" : "Reprendre la démo automatique"}
            title={isPlaying ? "Mettre en pause" : "Reprendre"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-xs text-slate-300 transition hover:border-cyan-200/30 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
          >
            {isPlaying ? "Ⅱ" : "▶"}
          </button>
        </div>

        <div
          key={activeExample.id}
          role="tabpanel"
          id="skillflow-demo-panel"
          aria-labelledby={`skillflow-demo-tab-${activeExample.id}`}
          className="showcase-panel mt-4 rounded-xl border border-cyan-300/10 bg-[#0b1221] p-4 sm:p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200">{activeExample.eyebrow}</p>
            <span className="font-mono text-[10px] text-slate-600">SKILL.md</span>
          </div>
          <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.035] p-3.5">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-400/10 text-violet-200">Vous</span>
              Votre demande
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-300">{activeExample.prompt}</p>
          </div>
          <div className="mt-3 rounded-xl border border-cyan-300/[0.08] bg-cyan-300/[0.035] p-3.5">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-cyan-300/10">✦</span>
              Réponse guidée
              <span className="ml-auto rounded-full border border-cyan-300/10 px-2 py-0.5 text-[9px] text-cyan-100/70">{activeExample.tag}</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-300">{activeExample.answer}</p>
          </div>
          <div className="mt-4 flex items-center justify-between text-[10px] text-slate-500">
            <span>Un exemple illustratif du pack</span>
            <span>{String(activeIndex + 1).padStart(2, "0")} / {String(examples.length).padStart(2, "0")}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1">Claude</span>
            <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1">ChatGPT</span>
            <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1">Exemple illustratif</span>
          </div>
          <span className="text-[11px] text-slate-500">Instructions + guide inclus</span>
        </div>
      </div>
      <div className="absolute -bottom-5 -left-5 hidden items-center gap-3 rounded-2xl border border-white/10 bg-[#151f32]/95 px-4 py-3 shadow-2xl sm:flex">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-200">↗</span>
        <div>
          <p className="text-xs font-semibold text-white">Un format à votre portée</p>
          <p className="mt-1 text-[10px] text-slate-500">Téléchargez et installez à votre rythme</p>
        </div>
      </div>
    </div>
  );
}
