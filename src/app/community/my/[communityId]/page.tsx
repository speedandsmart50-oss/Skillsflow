import { connection } from "next/server";
import { MemberCommunityWorkspace } from "@/components/community/member-community-workspace";
import { requirePageUser } from "@/lib/security/page-auth";

export const instant = false;

export default async function MemberCommunityPage({ params }: { params: Promise<{ communityId: string }> }) {
  await connection();
  const { communityId } = await params;
  const user = await requirePageUser(`/community/my/${communityId}`);
  return <MemberCommunityWorkspace communityId={communityId} userId={user.id} />;
}
