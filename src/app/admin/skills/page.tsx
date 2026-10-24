import { AdminSkillLibrary } from "@/components/admin-skill-library";
import { requireAdminPage } from "@/lib/security/page-auth";
import { connection } from "next/server";

export const instant = false;
export default async function AdminLibraryPage() {
  await connection();
  await requireAdminPage("/admin/skills");
  return <AdminSkillLibrary />;
}
