import { connection } from "next/server";
import { MyCommunities } from "@/components/community/my-communities";
import { requirePageUser } from "@/lib/security/page-auth";

export const instant = false;

export default async function MyCommunitiesPage() {
  await connection();
  await requirePageUser("/community/my");
  return <MyCommunities />;
}
