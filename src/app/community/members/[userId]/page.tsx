import { connection } from "next/server";
import { MemberCommunityProfile } from "@/components/community/member-community-profile";
import { requirePageUser } from "@/lib/security/page-auth";

export const instant = false;

export default async function CommunityMemberProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  await connection();
  const { userId } = await params;
  await requirePageUser(`/community/members/${userId}`);
  return <MemberCommunityProfile userId={userId} />;
}
