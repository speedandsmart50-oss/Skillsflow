import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ApiRateLimitScope = "mcp_user" | "mcp_ip" | "checkout_user" | "conversation_user" | "auth_ip";

export type ApiRateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
};

type RateLimitRpcClient = Pick<SupabaseClient, "rpc">;

/**
 * Build a server-side, non-guessable subject key for an anonymous client IP,
 * using the service-role key as HMAC key so the fingerprint cannot be reversed.
 */
export function getRateLimitIpSubjectKey(request: Request): string | null {
  const forwardedIp = (request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!forwardedIp || !serviceRoleKey || !isIP(forwardedIp)) return null;
  return `ip:${createHmac("sha256", serviceRoleKey).update(forwardedIp).digest("hex")}`;
}

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
