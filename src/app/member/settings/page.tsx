import Link from "next/link";
import { requirePageUser } from "@/lib/security/page-auth";
import { connection } from "next/server";

export const instant = false;
export default async function MemberSettings() {
  await connection();
  await requirePageUser("/member/settings");
  return <main className="min-h-screen bg-[#0b1020] px-4 py-8 text-slate-100 sm:px-8"><div className="mx-auto max-w-4xl"><Link className="text-cyan-200" href="/member/skills">← Bibliothèque</Link><section className="mt-6 rounded-3xl border border-white/10 bg-[#111a2b] p-7"><p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Compte et confidentialité</p><h1 className="mt-2 text-3xl font-semibold">Vos paramètres membre</h1><p className="mt-4 leading-7 text-slate-300">Vos conversations restent privées et ne servent pas à entraîner un modèle partagé. Vous pouvez les gérer dans votre espace agent.</p><Link className="mt-5 inline-flex rounded-full bg-cyan-300 px-5 py-3 font-bold text-slate-950" href="/account">Gérer mon compte et mes données</Link></section></div></main>;
}
