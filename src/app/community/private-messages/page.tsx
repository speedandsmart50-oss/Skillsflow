import { connection } from "next/server";
import { PrivateMemberMessages } from "@/components/community/private-member-messages";
import { requirePageUser } from "@/lib/security/page-auth";

export const instant = false;

export default async function PrivateMessagesPage() {
  await connection();
  const user = await requirePageUser("/community/private-messages");
  return <PrivateMemberMessages userId={user.id} />;
}
