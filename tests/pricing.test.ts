import test from "node:test";
import assert from "node:assert/strict";

import { calculateProductPrice, InvalidCouponError } from "../src/lib/pricing";

test("calculates the limited live pilot amount in XOF", () => {
  const price = calculateProductPrice();
  assert.equal(price.totalXof, 280);
  assert.equal(price.totalEur, 0.43);
});

test("calculates the regular product price in XOF after the pilot", () => {
  assert.deepEqual(calculateProductPrice("", null), {
    productSlug: "prospection-ethique",
    couponCode: null,
    subtotalEur: 39,
    discountEur: 0,
    totalEur: 39,
    totalXof: 25582,
  });
});

test("BOOST deducts exactly ten euros and rounds the final XOF amount after the pilot", () => {
  assert.deepEqual(calculateProductPrice(" boost ", null), {
    productSlug: "prospection-ethique",
    couponCode: "BOOST",
    subtotalEur: 39,
    discountEur: 10,
    totalEur: 29,
    totalXof: 19023,
  });
});

test("ADMIN does not discount the product price", () => {
  assert.deepEqual(calculateProductPrice(" admin ", null), {
    productSlug: "prospection-ethique",
    couponCode: "ADMIN",
    subtotalEur: 39,
    discountEur: 0,
    totalEur: 39,
    totalXof: 25582,
  });
});

test("BOOST cannot make the limited pilot amount free or negative", () => {
  assert.throws(() => calculateProductPrice("BOOST"), InvalidCouponError);
});

test("rejects unknown coupon codes", () => {
  assert.throws(() => calculateProductPrice("INVALID"), InvalidCouponError);
});
