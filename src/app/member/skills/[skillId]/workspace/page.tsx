import { requirePageUser } from "@/lib/security/page-auth";
import { connection } from "next/server";
import { MemberSkills } from "@/components/member-skills";

export const instant = false;
export default async function SkillWorkspace({ params }: { params: Promise<{ skillId: string }> }) {
  const { skillId } = await params;
  await connection();
  await requirePageUser(`/member/skills/${skillId}/workspace`);
  return <MemberSkills skillId={skillId} />;
}
