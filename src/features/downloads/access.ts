import type { DownloadAccess } from "@/types/skillflow";

export const accessRules: DownloadAccess[] = [
  { productId: "skill-claude-ops", allowed: true, expiresAt: "2027-01-01T00:00:00Z" },
  { productId: "skill-frontend-qa", allowed: true, expiresAt: "2027-02-01T00:00:00Z" },
  { productId: "skill-growth-engine", allowed: false },
];

export function hasValidDownloadAccess(productId: string, hasPurchase: boolean): boolean {
  const access = accessRules.find((entry) => entry.productId === productId);
  return Boolean(access && access.allowed && hasPurchase);
}
