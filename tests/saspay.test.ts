import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import { isSasPayLiveReady, resolveSasPayTransaction, saspayRequest, verifySasPayWebhook } from "../src/lib/payments/saspay";

test("only a fully configured SasPay live account is considered ready", () => {
  const original = {
    apiKey: process.env.SASPAY_API_KEY,
    webhook: process.env.SASPAY_WEBHOOK_SECRET,
    serviceRole: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  process.env.SASPAY_API_KEY = "sk_live_example";
  process.env.SASPAY_WEBHOOK_SECRET = "webhook-secret";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-secret";
  assert.equal(isSasPayLiveReady(), true);

  process.env.SASPAY_API_KEY = "sk_test_example";
  assert.equal(isSasPayLiveReady(), false);

  if (original.apiKey === undefined) delete process.env.SASPAY_API_KEY;
  else process.env.SASPAY_API_KEY = original.apiKey;
  if (original.webhook === undefined) delete process.env.SASPAY_WEBHOOK_SECRET;
  else process.env.SASPAY_WEBHOOK_SECRET = original.webhook;
  if (original.serviceRole === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = original.serviceRole;
});

test("verifies SasPay webhook HMAC, timestamp, and freshness", () => {
  const originalSecret = process.env.SASPAY_WEBHOOK_SECRET;
  const secret = "test-only-webhook-secret";
  const rawBody = '{"event":"transaction.success","data":{"id":"payment-id"}}';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  process.env.SASPAY_WEBHOOK_SECRET = secret;

  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  assert.equal(verifySasPayWebhook(rawBody, signature, timestamp), true);
  assert.equal(verifySasPayWebhook(rawBody, "0".repeat(64), timestamp), false);
  assert.equal(verifySasPayWebhook(rawBody, signature, "not-a-timestamp"), false);

  const staleTimestamp = (Number(timestamp) - 301).toString();
  const staleSignature = createHmac("sha256", secret)
    .update(`${staleTimestamp}.${rawBody}`)
    .digest("hex");
  assert.equal(verifySasPayWebhook(rawBody, staleSignature, staleTimestamp), false);

  if (originalSecret === undefined) delete process.env.SASPAY_WEBHOOK_SECRET;
  else process.env.SASPAY_WEBHOOK_SECRET = originalSecret;
});

test("refuses non-live SasPay keys before making a network request", async () => {
  const originalKey = process.env.SASPAY_API_KEY;
  process.env.SASPAY_API_KEY = "sk_test_example";
  await assert.rejects(
    saspayRequest("/checkout-sessions/"),
    /A SasPay live key beginning with sk_live_ is required/,
  );
  if (originalKey === undefined) delete process.env.SASPAY_API_KEY;
  else process.env.SASPAY_API_KEY = originalKey;
});

test("sends live checkout requests with bearer authentication", async () => {
  const originalKey = process.env.SASPAY_API_KEY;
  const originalApiUrl = process.env.SASPAY_API_URL;
  const originalFetch = globalThis.fetch;
  process.env.SASPAY_API_KEY = "sk_live_checkout";
  process.env.SASPAY_API_URL = "https://api.example/api/v1";

  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://api.example/api/v1/checkout-sessions/");
    assert.equal(
      new Headers(init?.headers).get("authorization"),
      `Bearer ${process.env.SASPAY_API_KEY}`,
    );
    assert.equal(init?.method, "POST");
    return new Response(JSON.stringify({ success: true, data: { id: "session-id" } }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const result = await saspayRequest("/checkout-sessions/", { method: "POST" });
    assert.deepEqual(result, { id: "session-id" });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.SASPAY_API_KEY;
    else process.env.SASPAY_API_KEY = originalKey;
    if (originalApiUrl === undefined) delete process.env.SASPAY_API_URL;
    else process.env.SASPAY_API_URL = originalApiUrl;
  }
});

test("resolves a checkout session, then verifies the provider transaction", async () => {
  const originals = {
    key: process.env.SASPAY_API_KEY,
    url: process.env.SASPAY_API_URL,
    path: process.env.SASPAY_CHECKOUT_SESSION_STATUS_PATH,
    fetch: globalThis.fetch,
  };
  process.env.SASPAY_API_KEY = "sk_live_status";
  process.env.SASPAY_API_URL = "https://api.example/api/v1";
  process.env.SASPAY_CHECKOUT_SESSION_STATUS_PATH = "/checkout-sessions/{id}/";
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    const payload = calls.length === 1
      ? { success: true, data: { id: "session-id", payment_id: "payment-id" } }
      : { success: true, data: { id: "payment-id", status: "SUCCESS" } };
    return new Response(JSON.stringify(payload), { status: 200 });
  };
  try {
    const result = await resolveSasPayTransaction("session-id");
    assert.deepEqual(calls, [
      "https://api.example/api/v1/checkout-sessions/session-id/",
      "https://api.example/api/v1/payments/payment-id/verify/",
    ]);
    assert.deepEqual(result, { id: "payment-id", status: "SUCCESS" });
  } finally {
    globalThis.fetch = originals.fetch;
    if (originals.key === undefined) delete process.env.SASPAY_API_KEY;
    else process.env.SASPAY_API_KEY = originals.key;
    if (originals.url === undefined) delete process.env.SASPAY_API_URL;
    else process.env.SASPAY_API_URL = originals.url;
    if (originals.path === undefined) delete process.env.SASPAY_CHECKOUT_SESSION_STATUS_PATH;
    else process.env.SASPAY_CHECKOUT_SESSION_STATUS_PATH = originals.path;
  }
});
