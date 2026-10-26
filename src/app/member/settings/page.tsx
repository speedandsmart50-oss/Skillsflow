import { connection } from "next/server";
import { requirePageUser } from "@/lib/security/page-auth";
import { MemberProfileSettings } from "@/components/member-profile-settings";

export const instant = false;

export default async function MemberSettings() {
  await connection();
  await requirePageUser("/member/settings");
  return <MemberProfileSettings />;
}
