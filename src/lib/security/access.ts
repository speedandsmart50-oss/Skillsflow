import type { UserRole } from "@/types/skillflow";

export function hasAdminAccess(role: UserRole): boolean {
  return role === "admin";
}

export function canAccessDownload(role: UserRole, hasPurchase: boolean): boolean {
  return role === "admin" || (role === "customer" && hasPurchase);
}

export function validateSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}
