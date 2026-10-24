import { redirect } from "next/navigation";
import { connection } from "next/server";
import { requirePageUser } from "@/lib/security/page-auth";

export const instant = false;
export default async function MemberHome() {
  await connection();
  await requirePageUser("/member");
  redirect("/member/skills");
}
