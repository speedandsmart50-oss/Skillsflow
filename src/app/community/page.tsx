import { connection } from "next/server";
import { CommunityHome } from "@/components/community/community-home";
import { requirePageUser } from "@/lib/security/page-auth";

export const instant = false;

export default async function CommunityPage() {
  await connection();
  const user = await requirePageUser("/community");
  const metadataName = user.user_metadata.full_name;
  const initialName = typeof metadataName === "string" ? metadataName : "";
  return <CommunityHome initialName={initialName} />;
}
