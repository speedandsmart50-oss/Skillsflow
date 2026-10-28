import assert from "node:assert/strict";
import test from "node:test";
import { pricingOffers } from "../src/features/pricing/offers";

test("pricing offers expose the four subscription tiers and checkout paths", () => {
  const discovery = pricingOffers.find((offer) => offer.id === "discovery");
  const plus = pricingOffers.find((offer) => offer.id === "plus");
  const pro = pricingOffers.find((offer) => offer.id === "pro");
  const max = pricingOffers.find((offer) => offer.id === "max");

  assert.equal(discovery?.monthly.eur, "0 €");
  assert.equal(discovery?.cta, "Créer mon compte");
  assert.equal(plus?.monthly.eur, "14,90 €");
  assert.equal(plus?.annual?.eur, "149 €");
  assert.equal(plus?.availability, "available");
  assert.equal(plus?.checkoutHref, "/checkout?product=skillflow-plus");
  assert.equal(pro?.badge, "Recommandé");
  assert.equal(pro?.annual?.xof, "196 100 XOF");
  assert.equal(pro?.availability, "available");
  assert.equal(pro?.checkoutHref, "/checkout?product=skillflow-pro");
  assert.equal(max?.badge, "Accès Jarvis");
  assert.equal(max?.monthly.xof, "45 300 XOF");
});

