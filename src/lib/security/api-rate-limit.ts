import type { SupabaseClient } from "@supabase/supabase-js";

export type ApiRateLimitScope = "mcp_user" | "mcp_ip" | "checkout_user" | "conversation_user";

export type ApiRateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
};

type RateLimitRpcClient = Pick<SupabaseClient, "rpc">;

export async function consumeApiRateLimit(
  supabase: RateLimitRpcClient,
  scope: ApiRateLimitScope,
  subjectKey: string,
): Promise<ApiRateLimitDecision> {
  const { data, error } = await supabase.rpc("consume_api_rate_limit", {
    p_scope: scope,
    p_subject_key: subjectKey,
  });

  if (error) throw new Error("Rate limit service unavailable.");

  const value = Array.isArray(data) ? data[0] : data;
  if (!value || typeof value !== "object") {
    throw new Error("Rate limit service returned an invalid response.");
  }

  const row = value as Record<string, unknown>;
  if (
    typeof row.allowed !== "boolean"
    || !Number.isFinite(Number(row.retry_after_seconds))
    || !Number.isFinite(Number(row.remaining))
  ) {
    throw new Error("Rate limit service returned an invalid response.");
  }

  return {
    allowed: row.allowed,
    retryAfterSeconds: Math.max(0, Math.ceil(Number(row.retry_after_seconds))),
    remaining: Math.max(0, Math.floor(Number(row.remaining))),
  };
}
