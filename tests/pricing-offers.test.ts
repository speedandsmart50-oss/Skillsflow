import assert from "node:assert/strict";
import test from "node:test";
import { pricingOffers } from "../src/features/pricing/offers";

test("pricing offers expose the public pricing and real checkout paths", () => {
  const premium = pricingOffers.find((offer) => offer.id === "premium-skill");
  const pack = pricingOffers.find((offer) => offer.id === "pack");
  const plus = pricingOffers.find((offer) => offer.id === "plus");

  assert.equal(premium?.price, "39 €");
  assert.equal(premium?.checkoutHref, "/checkout?product=prospection-ethique");
  assert.equal(pack?.price, "69 €");
  assert.equal(pack?.checkoutHref, "/checkout?product=pack-marketing-reseau");
  assert.equal(plus?.availability, "planned");
  assert.equal(plus?.checkoutHref, undefined);
});
