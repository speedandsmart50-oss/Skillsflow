export type SkillAccessCandidate = { id: string; product_id: string | null };

export function isSkillAccessible(
  skill: SkillAccessCandidate,
  entitlementProductIds: ReadonlySet<string>,
  activeGrantSkillIds: ReadonlySet<string>,
  isAdmin = false,
): boolean {
  return isAdmin
    || activeGrantSkillIds.has(skill.id)
    || Boolean(skill.product_id && entitlementProductIds.has(skill.product_id));
}
