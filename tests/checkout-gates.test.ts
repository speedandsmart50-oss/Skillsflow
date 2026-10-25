import assert from "node:assert/strict";
import test from "node:test";
import { hasAcceptedCheckoutTerms } from "../src/lib/checkout-acceptance";
import { canCheckout, isCommerceOpen } from "../src/lib/commerce";

test("commerce is controlled by the explicit production flag", () => {
  assert.equal(isCommerceOpen("false"), false);
  assert.equal(isCommerceOpen(undefined), false);
  assert.equal(isCommerceOpen("true"), true);
  assert.equal(canCheckout("true"), true);
  assert.equal(canCheckout("false"), false);
});

test("server-side checkout acceptance requires an explicit true value", () => {
  assert.equal(hasAcceptedCheckoutTerms({}), false);
  assert.equal(hasAcceptedCheckoutTerms({ legalAccepted: false }), false);
  assert.equal(hasAcceptedCheckoutTerms({ legalAccepted: "true" }), false);
  assert.equal(hasAcceptedCheckoutTerms({ legalAccepted: true }), true);
});
