import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { consumeApiRateLimit, getRateLimitIpSubjectKey } from "@/lib/security/api-rate-limit";
import type { SupabaseClient } from "@supabase/supabase-js";

function makeClient(result: unknown, failure: Error | null = null) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: result, error: failure };
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

test("uses the protected atomic RPC and normalizes an allowed decision", async () => {
  const { client, calls } = makeClient([{ allowed: true, retry_after_seconds: 0, remaining: 59 }]);

  const decision = await consumeApiRateLimit(client, "mcp_user", "user:12345678-1234-1234-1234-123456789012");

  assert.deepEqual(decision, { allowed: true, retryAfterSeconds: 0, remaining: 59 });
  assert.deepEqual(calls, [{
    name: "consume_api_rate_limit",
    args: { p_scope: "mcp_user", p_subject_key: "user:12345678-1234-1234-1234-123456789012" },
  }]);
});

test("keeps a denied decision and retry delay from the database", async () => {
  const { client } = makeClient([{ allowed: false, retry_after_seconds: 17.2, remaining: 0 }]);

  assert.deepEqual(await consumeApiRateLimit(client, "checkout_user", "user:12345678-1234-1234-1234-123456789012"), {
    allowed: false,
    retryAfterSeconds: 18,
    remaining: 0,
  });
});

test("fails closed if the limiter RPC fails or returns malformed data", async () => {
  const { client: failingClient } = makeClient(null, new Error("database unavailable"));
  const { client: malformedClient } = makeClient([{ allowed: "yes", retry_after_seconds: 0, remaining: 2 }]);

  const subject = "user:12345678-1234-1234-1234-123456789012";
  await assert.rejects(consumeApiRateLimit(failingClient, "mcp_user", subject), /Rate limit service unavailable/);
  await assert.rejects(consumeApiRateLimit(malformedClient, "mcp_user", subject), /invalid response/);
});

test("accepts the auth_ip scope for server-side authentication flows", async () => {
  const { client, calls } = makeClient([{ allowed: true, retry_after_seconds: 0, remaining: 9 }]);
  const subject = "ip:0123456789abcdef0123456789abcdef01234567";

  const decision = await consumeApiRateLimit(client, "auth_ip", subject);

  assert.deepEqual(decision, { allowed: true, retryAfterSeconds: 0, remaining: 9 });
  assert.deepEqual(calls, [{
    name: "consume_api_rate_limit",
    args: { p_scope: "auth_ip", p_subject_key: subject },
  }]);
});

test("fingerprints the caller IP for the authentication rate limit", () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sk_test_rate_limit_secret_value";
  const subject = getRateLimitIpSubjectKey(new Request("https://skillflow-sigma.vercel.app/auth/callback?code=abc", {
    headers: { "x-vercel-forwarded-for": "203.0.113.7, 10.0.0.1" },
  }));
  const expected = `ip:${createHmac("sha256", "sk_test_rate_limit_secret_value").update("203.0.113.7").digest("hex")}`;
  assert.equal(subject, expected);
});

test("returns no subject when the forwarded IP is invalid", () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sk_test_rate_limit_secret_value";
  const subject = getRateLimitIpSubjectKey(new Request("https://skillflow-sigma.vercel.app/", { headers: { "x-forwarded-for": "not-an-ip" } }));
  assert.equal(subject, null);
});
