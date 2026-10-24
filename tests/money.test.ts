import test from "node:test";
import assert from "node:assert/strict";

import { eurosToXof } from "../src/lib/money";

test("converts euros to the rounded BCEAO XOF parity", () => {
  assert.equal(eurosToXof(39), 25582);
  assert.equal(eurosToXof(0), 0);
});

test("rejects invalid euro amounts", () => {
  assert.throws(() => eurosToXof(-1), RangeError);
  assert.throws(() => eurosToXof(Number.NaN), RangeError);
});
