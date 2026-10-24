import test from "node:test";
import assert from "node:assert/strict";

import { canAccessDownload, hasAdminAccess, validateSlug } from "../src/lib/security/access";

test("admins always have access to protected actions", () => {
  assert.equal(hasAdminAccess("admin"), true);
  assert.equal(hasAdminAccess("customer"), false);
});

test("customer purchase grants download access", () => {
  assert.equal(canAccessDownload("customer", true), true);
  assert.equal(canAccessDownload("customer", false), false);
});

test("slug validation rejects invalid values", () => {
  assert.equal(validateSlug("claude-ops"), true);
  assert.equal(validateSlug("invalid slug"), false);
});
