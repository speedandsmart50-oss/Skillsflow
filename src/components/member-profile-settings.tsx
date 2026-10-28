"use client";

import { BackLink } from "@/components/back-link";
import Image from "next/image";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useMemberPreferences, type DashboardTheme, type MemberProfile } from "@/components/member-preferences-provider";

const themes: { id: DashboardTheme; name: string; detail: string; swatches: string[] }[] = [
  { id: "midnight", name: "Electric Indigo", detail: "Navy profond, bleu électrique & indigo", swatches: ["#0B1020", "#151F38", "#397BFF"] },
  { id: "original", name: "Original Skillflow", detail: "Le thème historique de la capture", swatches: ["#0B1220", "#0D2938", "#20DDF2"] },
  { id: "ocean", name: "Océan électrique", detail: "Bleu abyssal et turquoise vif", swatches: ["#041522", "#0b3048", "#31f0d1"] },
  { id: "violet", name: "Violet impérial", detail: "Indigo dense et lavande lumineuse", swatches: ["#100b22", "#291947", "#d0a7ff"] },
  { id: "light", name: "Clair signature", detail: "Ivoire net et accents pétrole", swatches: ["#edf3f8", "#ffffff", "#087f8c"] },
];

export function MemberProfileSettings() {
  const { profile, loading, saveProfile, uploadAvatar, removeAvatar } = useMemberPreferences();
  if (loading) {
    return (
      <main className="min-h-screen bg-[#0B1020] px-4 py-8 text-slate-100 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex min-h-[300px] items-center justify-center text-sm text-[#8F9CAE]">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#397BFF] border-t-transparent" />
              <span>Chargement de votre profil…</span>
            </div>
          </div>
        </div>
      </main>
    );
  }
  return <MemberProfileSettingsForm profile={profile} saveProfile={saveProfile} uploadAvatar={uploadAvatar} removeAvatar={removeAvatar} />;
}

function MemberProfileSettingsForm({
  profile,
  saveProfile,
  uploadAvatar,
  removeAvatar,
}: {
  profile: MemberProfile | null;
  saveProfile: (input: { displayName: string; theme: DashboardTheme }) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  removeAvatar: () => Promise<void>;
}) {
  const [name, setName] = useState(profile?.displayName ?? "");
  const [theme, setTheme] = useState<DashboardTheme>(profile?.theme ?? "midnight");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setError("");
    try {
      await saveProfile({ displayName: name, theme });
      setMessage("Votre profil et votre thème sont enregistrés.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Enregistrement impossible.");
    } finally {
      setPending(false);
    }
  }

  async function selectAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setPending(true);
    setMessage("");
    setError("");
    try {
      await uploadAvatar(file);
      setMessage("Votre photo de profil a été mise à jour.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Téléversement impossible.");
    } finally {
      setPending(false);
    }
  }

  async function clearAvatar() {
    setPending(true);
    setMessage("");
    setError("");
    try {
      await removeAvatar();
      setMessage("Votre photo de profil a été supprimée.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Suppression impossible.");
    } finally {
      setPending(false);
    }
  }

  const initials = (name || profile?.email || "M").trim().slice(0, 2).toUpperCase();

  return (
    <main className="min-h-screen bg-[#0B1020] px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <BackLink href="/account">
          <span>Retour à mon espace</span>
        </BackLink>

        <header className="mt-7 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#397BFF]">Skillsflow • Personnalisation</p>
          <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">Votre profil et vos réglages</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#8F9CAE]">
            Personnalisez votre identité visuelle sur Skillsflow. Vos préférences sont conservées et vous suivent sur tous vos appareils.
          </p>
        </header>

        {(error || message) && (
          <p
            role={error ? "alert" : "status"}
            className={`mt-6 rounded-2xl border p-4 text-sm font-medium ${
              error ? "border-rose-500/30 bg-rose-500/10 text-rose-200" : "border-[#00F0A0]/30 bg-[#00F0A0]/10 text-[#00F0A0]"
            }`}
          >
            {error || message}
          </p>
        )}

        <div className="mt-7 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          {/* Photo Section */}
          <section className="rounded-3xl border border-[#202E50] bg-[#151F38] p-6 sm:p-8">
            <h2 className="text-xl font-bold text-white">Photo de profil</h2>
            <p className="mt-1 text-sm text-[#8F9CAE]">Une photo ou avatar pour vous identifier dans votre espace membre.</p>

            <div className="mt-6 flex flex-wrap items-center gap-5">
              <div
                className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#397BFF]/50 bg-[#1A2544] text-2xl font-bold text-white shadow-lg"
                aria-label={profile?.avatarUrl ? "Photo de profil actuelle" : "Initiale du profil"}
              >
                {profile?.avatarUrl ? (
                  <Image src={profile.avatarUrl} alt="Votre photo de profil" width={96} height={96} unoptimized className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </div>

              <div className="flex flex-col items-start gap-2.5">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => fileRef.current?.click()}
                  className="rounded-xl bg-gradient-to-r from-[#397BFF] to-[#6557FF] px-5 py-2.5 text-xs font-bold text-white shadow-md transition hover:brightness-110 disabled:opacity-60"
                >
                  {pending ? "Patientez…" : "Choisir une photo"}
                </button>

                {profile?.avatarUrl && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void clearAvatar()}
                    className="text-xs text-[#8F9CAE] underline underline-offset-4 transition hover:text-white disabled:opacity-60"
                  >
                    Supprimer la photo
                  </button>
                )}

                <span className="text-[11px] text-[#64748B]">JPG, PNG ou WebP • 3 Mo max</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => void selectAvatar(event)}
                  className="sr-only"
                  aria-label="Choisir une photo de profil"
                />
              </div>
            </div>

            <div className="mt-8 border-t border-[#202E50] pt-6">
              <p className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Adresse e-mail du compte</p>
              <p className="mt-1 break-all font-mono text-sm text-slate-200">{profile?.email}</p>
            </div>
          </section>

          {/* Theme & Name Section */}
          <section className="rounded-3xl border border-[#202E50] bg-[#151F38] p-6 sm:p-8">
            <h2 className="text-xl font-bold text-white">Apparence du tableau de bord</h2>
            <p className="mt-1 text-sm text-[#8F9CAE]">Le thème choisi est mémorisé sur votre compte et appliqué à votre espace.</p>

            <form onSubmit={(event) => void save(event)}>
              <label htmlFor="member-display-name" className="mt-6 block text-xs font-bold uppercase tracking-wider text-[#8F9CAE]">
                Nom d&apos;affichage
              </label>
              <input
                id="member-display-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={60}
                autoComplete="nickname"
                placeholder="Votre prénom ou nom"
                className="mt-2 w-full rounded-xl border border-[#202E50] bg-[#0B1020] px-4 py-3 text-sm text-white outline-none transition focus:border-[#397BFF] focus:ring-2 focus:ring-[#397BFF]/20"
              />

              <fieldset className="mt-7">
                <legend className="text-xs font-bold uppercase tracking-wider text-[#8F9CAE]">Choisir un thème</legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {themes.map((option) => (
                    <label
                      key={option.id}
                      className={`group flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition duration-200 hover:-translate-y-0.5 ${
                        theme === option.id
                          ? "border-[#397BFF] bg-[#397BFF]/10 shadow-[0_4px_16px_rgba(57,123,255,0.2)]"
                          : "border-[#202E50] bg-[#0B1020]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="dashboard-theme"
                        value={option.id}
                        checked={theme === option.id}
                        onChange={() => setTheme(option.id)}
                        className="sr-only"
                      />
                      <span className="flex h-10 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10" aria-hidden="true">
                        {option.swatches.map((color) => (
                          <span key={color} className="h-full flex-1" style={{ backgroundColor: color }} />
                        ))}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-white">{option.name}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-[#8F9CAE]">{option.detail}</span>
                      </span>
                      <span
                        className={`ml-auto h-4 w-4 shrink-0 rounded-full border ${
                          theme === option.id
                            ? "border-[#397BFF] bg-[#397BFF] ring-2 ring-[#397BFF]/30"
                            : "border-[#64748B]"
                        }`}
                        aria-hidden="true"
                      />
                    </label>
                  ))}
                </div>
              </fieldset>

              <button
                type="submit"
                disabled={pending}
                className="mt-8 rounded-xl bg-gradient-to-r from-[#397BFF] to-[#6557FF] px-6 py-3 font-bold text-white shadow-md transition hover:brightness-110 disabled:opacity-60"
              >
                {pending ? "Enregistrement…" : "Enregistrer mes réglages"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
