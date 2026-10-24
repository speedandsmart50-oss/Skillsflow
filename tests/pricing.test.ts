import test from "node:test";
import assert from "node:assert/strict";

import { calculateProductPrice, InvalidCouponError } from "../src/lib/pricing";

test("uses the standard public catalogue price by default", () => {
  const price = calculateProductPrice();
  assert.equal(price.totalXof, 25582);
  assert.equal(price.totalEur, 39);
});

test("calculates the regular product price in XOF", () => {
  assert.deepEqual(calculateProductPrice(""), {
    productSlug: "prospection-ethique",
    couponCode: null,
    subtotalEur: 39,
    discountEur: 0,
    totalEur: 39,
    totalXof: 25582,
  });
});

test("BOOST deducts ten euros and rounds the final XOF amount", () => {
  assert.deepEqual(calculateProductPrice(" boost "), {
    productSlug: "prospection-ethique",
    couponCode: "BOOST",
    subtotalEur: 39,
    discountEur: 10,
    totalEur: 29,
    totalXof: 19023,
  });
});

test("uses the catalogue price for other skills and applies discounts to that price", () => {
  assert.deepEqual(calculateProductPrice("", "skill-specialise", 25, 17000), {
    productSlug: "skill-specialise",
    couponCode: null,
    subtotalEur: 25,
    discountEur: 0,
    totalEur: 25,
    totalXof: 17000,
  });
  assert.deepEqual(calculateProductPrice("BOOST", "skill-specialise", 25, 17000), {
    productSlug: "skill-specialise",
    couponCode: "BOOST",
    subtotalEur: 25,
    discountEur: 10,
    totalEur: 15,
    totalXof: 9839,
  });
});

test("BOOST cannot make a low-priced product free or negative", () => {
  assert.throws(() => calculateProductPrice("BOOST", "skill-specialise", 5, 3279), InvalidCouponError);
});

test("rejects unknown coupon codes", () => {
  assert.throws(() => calculateProductPrice("INVALID"), InvalidCouponError);
  assert.throws(() => calculateProductPrice("ADMIN"), InvalidCouponError);
});
