"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

type Prospect = { id: string; name: string; stage: string };
type Reminder = {
  id: string;
  prospect_id: string;
  title: string;
  details: string;
  due_at: string;
  status: "draft" | "completed" | "cancelled";
};
type Metrics = {
  prospects_total: number;
  prospects_active: number;
  prospects_follow_up: number;
  prospects_won: number;
  reminders_draft: number;
  reminders_overdue: number;
  reminders_completed: number;
};
type DashboardPayload = {
  prospects: Prospect[];
  reminders: Reminder[];
  metrics: Metrics;
};

const fieldClass = "mt-1.5 w-full rounded-xl border border-[#27375B] bg-[#0D1527] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-[#71809B] focus:border-[#55DDF0] focus:ring-2 focus:ring-[#55DDF0]/15";

function localDateTimeValue() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function formatDueAt(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ProspectionReminders() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyReminder, setBusyReminder] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    prospect_id: "",
    title: "",
    details: "",
    due_at: "",
  });

  const fetchDashboard = useCallback(async (): Promise<DashboardPayload> => {
    const { data } = await getSupabaseClient().auth.getSession();
    if (!data.session) throw new Error("Reconnectez-vous pour continuer.");
    const response = await fetch("/api/member/prospection/reminders", {
      headers: { Authorization: ["Bear", "er "].join("") + data.session.access_token },
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Impossible de charger vos rappels.");
    return payload as DashboardPayload;
  }, []);

  useEffect(() => {
    let active = true;
    void fetchDashboard()
      .then((payload) => {
        if (active) setDashboard(payload);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : "Impossible de charger vos rappels.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchDashboard]);

  async function createReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { data } = await getSupabaseClient().auth.getSession();
      if (!data.session) throw new Error("Reconnectez-vous pour continuer.");
      const response = await fetch("/api/member/prospection/reminders", {
        method: "POST",
        headers: {
          Authorization: ["Bear", "er "].join("") + data.session.access_token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...form, due_at: new Date(form.due_at).toISOString() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Impossible de créer ce rappel.");
      setForm({ prospect_id: "", title: "", details: "", due_at: "" });
      setDashboard(await fetchDashboard());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de créer ce rappel.");
    } finally {
      setSaving(false);
    }
  }

  async function updateReminder(id: string, action: "complete" | "cancel") {
    setBusyReminder(id);
    setError("");
    try {
      const { data } = await getSupabaseClient().auth.getSession();
      if (!data.session) throw new Error("Reconnectez-vous pour continuer.");
      const response = await fetch("/api/member/prospection/reminders", {
        method: "PATCH",
        headers: {
          Authorization: ["Bear", "er "].join("") + data.session.access_token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Impossible de mettre à jour le rappel.");
      setDashboard(await fetchDashboard());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de mettre à jour le rappel.");
    } finally {
      setBusyReminder("");
    }
  }

  return (
    <section className="mt-8 rounded-3xl border border-[#202E50] bg-[#11182B] p-5 shadow-[0_24px_80px_rgba(0,0,0,.22)] sm:p-7" aria-labelledby="prospection-reminders-heading">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#20DDF2]">Votre activité</p>
          <h2 id="prospection-reminders-heading" className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">Indicateurs et rappels</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8F9CAE]">
            Des repères et rappels privés liés à vos propres prospects. Ils restent internes : aucun message n’est envoyé.
          </p>
        </div>
      </div>

      {error && <p role="alert" className="mt-5 rounded-xl border border-rose-300/25 bg-rose-300/10 p-3 text-sm text-rose-100">{error}</p>}
      {loading && <p role="status" className="mt-5 rounded-xl border border-[#27375B] bg-[#0D1527] p-3 text-sm text-[#A8B7CB]">Chargement de vos indicateurs…</p>}
      {!loading && dashboard && (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Prospects suivis", value: dashboard.metrics.prospects_total },
              { label: "À relancer dans le pipeline", value: dashboard.metrics.prospects_follow_up },
              { label: "Rappels à venir", value: dashboard.metrics.reminders_draft - dashboard.metrics.reminders_overdue },
              { label: "Rappels en retard", value: dashboard.metrics.reminders_overdue },
            ].map((metric) => (
              <article key={metric.label} className="rounded-xl border border-[#27375B] bg-[#0D1527]/70 px-4 py-4">
                <p className="text-2xl font-black text-white">{metric.value}</p>
                <p className="mt-1 text-xs font-semibold text-[#A8B7CB]">{metric.label}</p>
              </article>
            ))}
          </div>
          <p className="mt-3 text-xs text-[#71809B]">
            {dashboard.metrics.prospects_active} prospects actifs · {dashboard.metrics.prospects_won} convertis · {dashboard.metrics.reminders_completed} rappels terminés
          </p>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <form onSubmit={(event) => void createReminder(event)} className="space-y-4 rounded-2xl border border-[#27375B] bg-[#0D1527] p-4 sm:p-5">
              <h3 className="text-base font-bold text-white">Préparer un rappel</h3>
              {dashboard.prospects.length === 0 ? (
                <p className="text-sm leading-6 text-[#A8B7CB]">Ajoutez d’abord un prospect dans votre pipeline pour pouvoir lui associer un rappel.</p>
              ) : (
                <>
                  <label className="block text-xs font-semibold text-[#A8B7CB]">
                    Prospect
                    <select required value={form.prospect_id} onChange={(event) => setForm({ ...form, prospect_id: event.target.value })} className={fieldClass}>
                      <option value="">Choisir un prospect</option>
                      {dashboard.prospects.map((prospect) => <option key={prospect.id} value={prospect.id}>{prospect.name}</option>)}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-[#A8B7CB]">
                    Rappel
                    <input required maxLength={140} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Ex. Préparer la prochaine étape" className={fieldClass} />
                  </label>
                  <label className="block text-xs font-semibold text-[#A8B7CB]">
                    Note (facultative)
                    <textarea maxLength={1000} value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} rows={3} className={fieldClass} />
                  </label>
                  <label className="block text-xs font-semibold text-[#A8B7CB]">
                    Date et heure
                    <input required type="datetime-local" min={localDateTimeValue()} value={form.due_at} onFocus={() => { if (!form.due_at) setForm((current) => ({ ...current, due_at: localDateTimeValue() })); }} onChange={(event) => setForm({ ...form, due_at: event.target.value })} className={fieldClass} />
                  </label>
                  <button disabled={saving} type="submit" className="min-h-11 w-full rounded-xl bg-[#20DDF2] px-4 py-3 text-sm font-bold text-[#06131F] transition hover:bg-[#70E9F5] disabled:cursor-not-allowed disabled:opacity-60">
                    {saving ? "Enregistrement…" : "Enregistrer le rappel"}
                  </button>
                </>
              )}
            </form>

            <div className="space-y-3">
              <h3 className="text-base font-bold text-white">Vos rappels</h3>
              {dashboard.reminders.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#27375B] p-6 text-center text-sm text-[#8F9CAE]">Aucun rappel pour le moment.</p>
              ) : dashboard.reminders.map((reminder) => {
                const prospect = dashboard.prospects.find((item) => item.id === reminder.prospect_id);
                return (
                  <article key={reminder.id} className="rounded-xl border border-[#27375B] bg-[#0D1527]/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{reminder.title}</p>
                        <p className="mt-1 text-xs text-[#8F9CAE]">{prospect?.name ?? "Prospect"} · {formatDueAt(reminder.due_at)}</p>
                        {reminder.details && <p className="mt-2 whitespace-pre-wrap text-sm text-[#A8B7CB]">{reminder.details}</p>}
                      </div>
                      <span className="rounded-full border border-[#397BFF]/25 bg-[#397BFF]/[.07] px-2.5 py-1 text-[11px] font-semibold text-[#9AB9FF]">
                        {reminder.status === "draft" ? "À faire" : reminder.status === "completed" ? "Terminé" : "Annulé"}
                      </span>
                    </div>
                    {reminder.status === "draft" && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" disabled={busyReminder === reminder.id} onClick={() => void updateReminder(reminder.id, "complete")} className="min-h-9 rounded-lg border border-emerald-300/25 px-3 text-xs font-semibold text-emerald-200 hover:bg-emerald-300/10 disabled:opacity-50">Terminer</button>
                        <button type="button" disabled={busyReminder === reminder.id} onClick={() => void updateReminder(reminder.id, "cancel")} className="min-h-9 rounded-lg border border-rose-300/25 px-3 text-xs font-semibold text-rose-200 hover:bg-rose-300/10 disabled:opacity-50">Annuler</button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
