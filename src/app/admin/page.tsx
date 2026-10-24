import { requireAdminPage } from "@/lib/security/page-auth";
import { AdminDashboard } from "@/components/admin-dashboard";

export const instant = false;

export default async function AdminPage() {
  await requireAdminPage("/admin");
  return <AdminDashboard />;
}
