import assert from "node:assert/strict";
import test from "node:test";

import { matchesFileContentType } from "@/lib/security/file-content";

test("accepts supported image signatures and rejects mismatched MIME labels", () => {
  assert.equal(matchesFileContentType(new Uint8Array([0xff, 0xd8, 0xff, 0x00]), "image/jpeg"), true);
  assert.equal(matchesFileContentType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png"), true);
  assert.equal(matchesFileContentType(new TextEncoder().encode("<html>"), "image/png"), false);
  assert.equal(matchesFileContentType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]), "image/webp"), true);
});

test("checks document signatures and structured text", () => {
  assert.equal(matchesFileContentType(new TextEncoder().encode("%PDF-1.7"), "application/pdf"), true);
  assert.equal(matchesFileContentType(new TextEncoder().encode("hello"), "text/plain"), true);
  assert.equal(matchesFileContentType(new TextEncoder().encode("{\"safe\":true}"), "application/json"), true);
  assert.equal(matchesFileContentType(new TextEncoder().encode("{broken"), "application/json"), false);
});
