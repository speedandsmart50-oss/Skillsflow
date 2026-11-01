import test from "node:test";
import assert from "node:assert/strict";

import {
  canAccessDownload,
  canAccessPaidFeature,
  hasAdminAccess,
  isConfiguredAdminEmail,
  validateSlug,
} from "../src/lib/security/access";

test("admins always have access to protected actions", () => {
  assert.equal(hasAdminAccess("admin"), true);
  assert.equal(hasAdminAccess("client"), false);
});

test("a client purchase grants download access", () => {
  assert.equal(canAccessDownload("client", true), true);
  assert.equal(canAccessDownload("client", false), false);
});

test("the configured administrator email is matched exactly without case sensitivity", () => {
  assert.equal(isConfiguredAdminEmail(" owner@example.com ", "OWNER@example.com"), true);
  assert.equal(isConfiguredAdminEmail("other@example.com", "owner@example.com"), false);
  assert.equal(isConfiguredAdminEmail("owner@example.com", undefined), false);
});

test("paid features are available to admins and active subscribers only", () => {
  assert.equal(canAccessPaidFeature("admin", false, false), true);
  assert.equal(canAccessPaidFeature("client", true, false), true);
  assert.equal(canAccessPaidFeature("client", false, true), true);
  assert.equal(canAccessPaidFeature("client", false, false), false);
});

test("slug validation rejects invalid values", () => {
  assert.equal(validateSlug("claude-ops"), true);
  assert.equal(validateSlug("invalid slug"), false);
});
