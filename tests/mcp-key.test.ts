import test from "node:test";
import assert from "node:assert/strict";

import { createMcpKey, hashMcpKey, parseMcpBearerToken } from "../src/lib/security/mcp-keys";

test("MCP keys are random and stored as SHA-256 hashes", () => {
  const first = createMcpKey();
  const second = createMcpKey();

  assert.match(first.value, /^sf_[A-Za-z0-9_-]{43}$/);
  assert.match(first.hash, /^[0-9a-f]{64}$/);
  assert.notEqual(first.value, second.value);
  assert.notEqual(first.hash, first.value);
});

test("MCP bearer authentication accepts only generated key formats", () => {
  const { value } = createMcpKey();
  assert.equal(parseMcpBearerToken(`Bearer ${value}`), value);
  assert.equal(parseMcpBearerToken(`Basic ${value}`), null);
  assert.equal(parseMcpBearerToken("Bearer sf_short"), null);
  assert.equal(hashMcpKey(value).length, 64);
});
