import { requirePageUser } from "@/lib/security/page-auth";
import { connection } from "next/server";
import { MemberSkills } from "@/components/member-skills";

export const instant = false;
export default async function SkillsPage() {
  await connection();
  await requirePageUser("/member/skills");
  return <MemberSkills />;
}
