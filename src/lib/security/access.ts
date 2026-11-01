import type { UserRole } from "@/types/skillflow";

export function hasAdminAccess(role: UserRole): boolean {
  return role === "admin";
}

export function isConfiguredAdminEmail(
  userEmail: string | null | undefined,
  configuredEmail: string | undefined,
): boolean {
  const normalizedUserEmail = userEmail?.trim().toLowerCase();
  const normalizedConfiguredEmail = configuredEmail?.trim().toLowerCase();
  return Boolean(normalizedUserEmail && normalizedConfiguredEmail && normalizedUserEmail === normalizedConfiguredEmail);
}

export function canAccessPaidFeature(
  role: UserRole | null | undefined,
  isConfiguredAdmin: boolean,
  hasPaidEntitlement: boolean,
): boolean {
  return role === "admin" || isConfiguredAdmin || hasPaidEntitlement;
}

export function canAccessDownload(role: UserRole, hasPurchase: boolean): boolean {
  return role === "admin" || (role === "client" && hasPurchase);
}

export function validateSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}
