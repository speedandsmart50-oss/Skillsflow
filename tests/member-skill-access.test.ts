import assert from "node:assert/strict";
import test from "node:test";
import { isSkillAccessible } from "@/lib/security/skill-access";

test("a skill linked to an active purchase entitlement is accessible", () => {
  assert.equal(isSkillAccessible({ id: "skill-a", product_id: "product-a" }, new Set(["product-a"]), new Set()), true);
});

test("a skill without an entitlement or active member grant stays private", () => {
  assert.equal(isSkillAccessible({ id: "skill-a", product_id: "product-a" }, new Set(), new Set()), false);
});

test("included membership flag alone does not grant access without an active subscription grant", () => {
  assert.equal(isSkillAccessible({ id: "skill-a", product_id: null }, new Set(), new Set()), false);
});

test("trusted active grants and administrators can access skills", () => {
  const skill = { id: "skill-a", product_id: null };
  assert.equal(isSkillAccessible(skill, new Set(), new Set(["skill-a"])), true);
  assert.equal(isSkillAccessible(skill, new Set(), new Set(), true), true);
});
