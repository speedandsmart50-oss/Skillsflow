import test from "node:test";
import assert from "node:assert/strict";

import { canAccessDownload, hasAdminAccess, validateSlug } from "../src/lib/security/access";

test("admins always have access to protected actions", () => {
  assert.equal(hasAdminAccess("admin"), true);
  assert.equal(hasAdminAccess("client"), false);
});

test("a client purchase grants download access", () => {
  assert.equal(canAccessDownload("client", true), true);
  assert.equal(canAccessDownload("client", false), false);
});

test("slug validation rejects invalid values", () => {
  assert.equal(validateSlug("claude-ops"), true);
  assert.equal(validateSlug("invalid slug"), false);
});
