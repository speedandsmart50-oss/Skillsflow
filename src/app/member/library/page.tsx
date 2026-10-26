import { BackLink } from "@/components/back-link";
import { requirePageUser } from "@/lib/security/page-auth";
import { connection } from "next/server";
import { AccountConversations } from "@/components/account-conversations";

export const instant = false;
export default async function MemberLibrary() {
  await connection();
  await requirePageUser("/member/library");
  return <main className="min-h-screen bg-[#0b1020] px-4 py-8 text-slate-100 sm:px-8"><div className="mx-auto max-w-5xl"><BackLink href="/member/skills">Bibliothèque</BackLink><div className="mt-6"><AccountConversations /></div></div></main>;
}
