import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const OAUTH_SCOPES = ["mcp:read", "mcp:write"] as const;
export const ACCESS_TOKEN_TTL_SECONDS = 3600;
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

export function appOrigin(request?: Request) {
  // The OAuth issuer must match the host the client connected to: it may be a
  // custom domain, a preview deployment or localhost. NEXT_PUBLIC_APP_URL stays
  // the fallback for contexts without a request (and for outbound links).
  if (request) {
    try {
      const origin = new URL(request.url).origin;
      if (origin && origin !== "null") return origin;
    } catch {
      // Fall through to the configured origin.
    }
  }
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return configured ? configured.replace(/\/$/, "") : "http://localhost:3000";
}

function normalizeResource(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export function configuredMcpResourceUrl() {
  const configured = process.env.NEXT_PUBLIC_MCP_RESOURCE_URL?.trim();
  return configured ? normalizeResource(configured) : null;
}

export function mcpResourceUrl(request?: Request) {
  return configuredMcpResourceUrl() ?? normalizeResource(`${appOrigin(request)}/mcp`);
}

/**
 * Some clients connect through a custom domain while NEXT_PUBLIC_APP_URL points
 * at the canonical deployment. Accepting both keeps RFC 8707 `resource` values
 * working without weakening the check: every value below is still a SkillFlow
 * MCP endpoint.
 */
export function acceptedMcpResources(request?: Request) {
  const values = new Set<string>();
  const configured = configuredMcpResourceUrl();
  if (configured) values.add(configured);
  if (request) values.add(normalizeResource(`${new URL(request.url).origin}/mcp`));
  values.add(mcpResourceUrl(request));
  return values;
}

export function isAcceptedMcpResource(request: Request, value: string | null | undefined) {
  if (!value) return false;
  return acceptedMcpResources(request).has(normalizeResource(value));
}

export function hashOpaque(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createOpaque(prefix: string) {
  return `${prefix}_${randomBytes(32).toString("base64url")}`;
}

export function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function parseBearer(request: Request) {
  return request.headers.get("authorization")?.match(/^Bearer\s+([^\s]+)$/i)?.[1] ?? null;
}

export function supportedScope(scope: string | null | undefined) {
  const requested = (scope || "mcp:read").split(/\s+/).filter(Boolean);
  const granted = requested.filter((value): value is typeof OAUTH_SCOPES[number] => OAUTH_SCOPES.includes(value as typeof OAUTH_SCOPES[number]));
  return granted.length ? Array.from(new Set(granted)).join(" ") : "mcp:read";
}

export function oauthJson(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  const headers = {
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...extraHeaders,
  };
  if (status === 204) return new Response(null, { status, headers });
  return Response.json(data, {
    status,
    headers,
  });
}

export function oauthError(error: string, description: string, status = 400) {
  return oauthJson({ error, error_description: description }, status);
}

export function isAllowedRedirectUri(value: string) {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.hash) return false;
    if (url.protocol === "https:") return true;
    return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

export function redirectMatches(redirectUris: unknown, requested: string) {
  return Array.isArray(redirectUris) && redirectUris.length > 0 && redirectUris.every((value) => typeof value === "string") && redirectUris.includes(requested);
}

export async function getOauthUser() {
  const { createServerClient } = await import("@supabase/ssr");
  const { cookies } = await import("next/headers");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  const cookieStore = await cookies();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
    },
  });
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function validateAccessToken(token: string, request: Request, requiredScope = "mcp:read") {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("oauth_access_tokens")
    .select("token_hash,user_id,resource,scope,expires_at,revoked_at")
    .eq("token_hash", hashOpaque(token))
    .maybeSingle();
  if (error || !data || data.revoked_at || !isAcceptedMcpResource(request, data.resource) || new Date(data.expires_at).getTime() <= Date.now()) return null;
  if (!data.scope.split(/\s+/).includes(requiredScope)) return { insufficientScope: true as const, userId: data.user_id, scope: data.scope };
  void supabase.from("oauth_access_tokens").update({ last_used_at: new Date().toISOString() }).eq("token_hash", data.token_hash);
  return { userId: data.user_id, scope: data.scope };
}
