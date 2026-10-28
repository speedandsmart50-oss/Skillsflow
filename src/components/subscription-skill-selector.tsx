"use client";

import { useEffect, useState } from "react";

type SubscriptionData = {
  subscription: { plan_slug: string; limit: number; ends_at: string } | null;
  selectedSkillIds?: string[];
  skills: { id: string; slug: string; name: string; short_description: string }[];
};

export function SubscriptionSkillSelector() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/account/subscription-skills", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401 || response.status === 404) return null;
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Impossible de charger vos skills inclus.");
        return payload as SubscriptionData;
      })
      .then((payload) => {
        if (!payload) return;
        setData(payload);
        setSelected(payload.selectedSkillIds ?? []);
      })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Impossible de charger vos skills inclus."));
  }, []);

  if (!data?.subscription) return null;
  const subscriptionLimit = data.subscription.limit;

  function toggleSkill(skillId: string) {
    setSelected((current) => current.includes(skillId)
      ? current.filter((id) => id !== skillId)
      : current.length < subscriptionLimit ? [...current, skillId] : current);
  }

  async function save() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/account/subscription-skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillIds: selected }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Impossible d’enregistrer votre sélection.");
      setMessage("Votre sélection de skills est enregistrée.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Impossible d’enregistrer votre sélection.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-3xl border border-[#202E50] bg-[#151F38] p-6 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#397BFF]">Skills inclus</p>
      <h3 className="mt-2 text-2xl font-black text-white">Choisissez vos skills actifs</h3>
      <p className="mt-2 text-sm leading-6 text-[#8F9CAE]">Votre abonnement {data.subscription.plan_slug.replace("skillflow-", "").toUpperCase()} permet de sélectionner {data.subscription.limit} skill{data.subscription.limit > 1 ? "s" : ""}.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {data.skills.map((skill) => (
          <label key={skill.id} className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition ${selected.includes(skill.id) ? "border-[#397BFF] bg-[#397BFF]/10" : "border-[#202E50] bg-[#0B1020]"}`}>
            <input type="checkbox" checked={selected.includes(skill.id)} onChange={() => toggleSkill(skill.id)} className="mt-1 h-4 w-4 accent-[#397BFF]" />
            <span>
              <span className="block font-bold text-white">{skill.name}</span>
              <span className="mt-1 block text-xs leading-5 text-[#8F9CAE]">{skill.short_description}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void save()} disabled={pending || selected.length < 1 || selected.length > subscriptionLimit} className="rounded-xl bg-gradient-to-r from-[#397BFF] to-[#6557FF] px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {pending ? "Enregistrement…" : "Enregistrer mes skills"}
        </button>
        {message && <p role="status" className="text-sm text-[#A5F3FC]">{message}</p>}
      </div>
    </section>
  );
}

