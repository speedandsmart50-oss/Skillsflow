import test from "node:test";
import assert from "node:assert/strict";

import { isAllowlistedAdmin } from "../src/lib/security/admin";

test("allowlisted admin check requires a verified exact email match", () => {
  assert.equal(isAllowlistedAdmin("Admin@example.com", true, "admin@example.com"), true);
  assert.equal(isAllowlistedAdmin("other@example.com", true, "admin@example.com"), false);
  assert.equal(isAllowlistedAdmin("admin@example.com", false, "admin@example.com"), false);
  assert.equal(isAllowlistedAdmin("admin@example.com", true, undefined), false);
});
