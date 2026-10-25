import test from "node:test";
import assert from "node:assert/strict";
import { processSasPayWebhook, reconcileVerifiedTransaction } from "../src/lib/payments/flow";

const order = {
  id: "order-1",
  order_reference: "SkillFlow order order-1",
  total_xof: 306,
  currency: "XOF",
};
const transaction = {
  id: "transaction-1",
  description: order.order_reference,
  requested_amount: "306",
  currency: "XOF",
  status: "SUCCESS",
};
const signed = (event = "transaction.success") => ({
  rawBody: JSON.stringify({ event, data: { id: transaction.id } }),
  signature: "valid-signature",
  timestamp: "123",
  eventHeader: event,
});

function webhookDependencies(overrides: Record<string, unknown> = {}) {
  let activationCount = 0;
  return {
    get activationCount() { return activationCount; },
    verifySignature: () => true,
    verifyTransaction: async () => transaction,
    findOrder: async () => order,
    activate: async () => { activationCount += 1; return activationCount === 1; },
    markTerminal: async () => undefined,
    ...overrides,
  };
}

test("accepts a signed webhook only after provider verification and activation", async () => {
  const dependencies = webhookDependencies();
  const result = await processSasPayWebhook(signed(), dependencies);
  assert.equal(result.status, 200);
  assert.equal(dependencies.activationCount, 1);
});

test("repeated successful webhook stays idempotent and acknowledged", async () => {
  const dependencies = webhookDependencies();
  const first = await processSasPayWebhook(signed(), dependencies);
  const second = await processSasPayWebhook(signed(), dependencies);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(dependencies.activationCount, 2);
  assert.equal("alreadyPaid" in second && second.alreadyPaid, true);
});

test("rejects an invalid webhook signature before provider lookup", async () => {
  let lookups = 0;
  const dependencies = webhookDependencies({
    verifySignature: () => false,
    verifyTransaction: async () => { lookups += 1; return transaction; },
  });
  const result = await processSasPayWebhook(signed(), dependencies);
  assert.equal(result.status, 401);
  assert.equal(lookups, 0);
});

test("rejects an unknown order reference after provider verification", async () => {
  const dependencies = webhookDependencies({ findOrder: async () => null });
  const result = await processSasPayWebhook(signed(), dependencies);
  assert.equal(result.status, 404);
});

test("customer return activates a provider-confirmed payment through the shared flow", async () => {
  let source = "";
  const result = await reconcileVerifiedTransaction(order, transaction, "return", {
    activate: async (_order, _transaction, activationSource) => { source = activationSource; return true; },
    markTerminal: async () => undefined,
  });
  assert.deepEqual(result, { activated: true, alreadyPaid: false });
  assert.equal(source, "return");
});

test("cron reconciles a paid order when the webhook was missed", async () => {
  let source = "";
  const result = await reconcileVerifiedTransaction(order, transaction, "cron", {
    activate: async (_order, _transaction, activationSource) => { source = activationSource; return true; },
    markTerminal: async () => undefined,
  });
  assert.deepEqual(result, { activated: true, alreadyPaid: false });
  assert.equal(source, "cron");
});

test("does not activate an amount, currency, or order-reference mismatch", async () => {
  let activations = 0;
  for (const mismatch of [
    { ...transaction, requested_amount: "305" },
    { ...transaction, currency: "EUR" },
    { ...transaction, description: "another-order" },
  ]) {
    const result = await reconcileVerifiedTransaction(order, mismatch, "webhook", {
      activate: async () => { activations += 1; return true; },
      markTerminal: async () => undefined,
    });
    assert.deepEqual(result, { activated: false, reason: "mismatch" });
  }
  assert.equal(activations, 0);
});

test("keeps a verified but pending SasPay payment pending", async () => {
  const result = await reconcileVerifiedTransaction(order, { ...transaction, status: "PENDING" }, "return", {
    activate: async () => assert.fail("Pending payments must not activate"),
    markTerminal: async () => undefined,
  });
  assert.deepEqual(result, { activated: false, reason: "pending" });
});
