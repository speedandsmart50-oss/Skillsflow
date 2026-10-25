import assert from "node:assert/strict";
import test from "node:test";

import { consumeApiRateLimit } from "@/lib/security/api-rate-limit";
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
