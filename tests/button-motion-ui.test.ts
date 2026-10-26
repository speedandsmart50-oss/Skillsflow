import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("interactive controls use distinct 3D hover treatments and respect reduced motion", async () => {
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(css, /@media \(hover: hover\) and \(prefers-reduced-motion: no-preference\)/);
  assert.match(css, /rotateX\(3deg\) scale\(1\.025\)/);
  assert.match(css, /rotateY\(2\.5deg\)/);
  assert.match(css, /rotateY\(12deg\) rotateX\(-5deg\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
