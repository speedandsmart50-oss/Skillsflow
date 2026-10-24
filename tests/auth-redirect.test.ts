import test from "node:test";
import assert from "node:assert/strict";
import { safeNextPath } from "../src/lib/security/redirect";

test("keeps local return paths and query strings", () => {
  assert.equal(safeNextPath("/account/downloads?from=login"), "/account/downloads?from=login");
});

test("rejects external and malformed return paths", () => {
  assert.equal(safeNextPath("https://attacker.example/"), "/account");
  assert.equal(safeNextPath("//attacker.example/"), "/account");
  assert.equal(safeNextPath(null), "/account");
});

test("supports an explicit recovery fallback", () => {
  assert.equal(safeNextPath(null, "/auth/reset-password"), "/auth/reset-password");
});
