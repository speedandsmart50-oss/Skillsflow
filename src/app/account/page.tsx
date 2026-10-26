import { requirePageUser } from "@/lib/security/page-auth";
import { AccountDashboard } from "@/components/account-dashboard";
import { MemberPreferencesProvider } from "@/components/member-preferences-provider";
import { connection } from "next/server";

export const instant = false;

export default async function AccountPage() {
  await connection();
  await requirePageUser("/account");
  return <MemberPreferencesProvider><AccountDashboard /></MemberPreferencesProvider>;
}
