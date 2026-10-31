import { createHash } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS, createOpaque, hashOpaque, oauthError, oauthJson, safeEqual } from "@/lib/oauth/server";

function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

function normalizeResource(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function basicCredentials(request: Request) {
  const header = request.headers.get("authorization");
  const match = header?.match(/^Basic\s+(.+)$/i);
  if (!match) return null;
  try {
    const [clientId, ...secret] = Buffer.from(match[1], "base64").toString("utf8").split(":");
    return clientId ? { clientId, secret: secret.join(":") } : null;
  } catch {
    return null;
  }
}

async function readClient(clientId: string, clientSecret: string | null) {
  const { data, error } = await getSupabaseAdminClient().from("oauth_clients").select("client_id,client_secret_hash,token_endpoint_auth_method").eq("client_id", clientId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (data.token_endpoint_auth_method === "client_secret_post" && (!clientSecret || !data.client_secret_hash || !safeEqual(hashOpaque(clientSecret), data.client_secret_hash))) return null;
  return data;
}

function tokenResponse(accessToken: string, refreshToken: string, scope: string) {
  return oauthJson({ access_token: accessToken, token_type: "Bearer", expires_in: ACCESS_TOKEN_TTL_SECONDS, refresh_token: refreshToken, scope }, 200, { Pragma: "no-cache" });
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return oauthError("invalid_request", "Le corps de la requête doit être encodé en formulaire.");
  }

  const grantType = String(form.get("grant_type") ?? "");
  const basic = basicCredentials(request);
  const clientId = String(form.get("client_id") ?? basic?.clientId ?? "");
  if (!clientId) return oauthError("invalid_client", "client_id est obligatoire.", 401);
  const clientSecret = form.get("client_secret") ? String(form.get("client_secret")) : basic?.secret || null;

  let client: Awaited<ReturnType<typeof readClient>>;
  try {
    client = await readClient(clientId, clientSecret);
  } catch (error) {
    console.error("Could not load OAuth client:", error instanceof Error ? error.message : "Unknown error");
    return oauthError("server_error", "Le service d'authentification est temporairement indisponible.", 503);
  }
  if (!client) return oauthError("invalid_client", "Client OAuth invalide.", 401);
  const supabase = getSupabaseAdminClient();

  try {
    if (grantType === "authorization_code") {
      const code = String(form.get("code") ?? "");
      const redirectUri = String(form.get("redirect_uri") ?? "");
      const verifier = String(form.get("code_verifier") ?? "");
      if (!code || !redirectUri || !verifier) return oauthError("invalid_request", "code, redirect_uri et code_verifier sont obligatoires.");
      const requestedResource = normalizeResource(String(form.get("resource") ?? ""));
      const { data, error } = await supabase.from("oauth_authorization_codes").select("code_hash,client_id,user_id,redirect_uri,code_challenge,resource,scope,expires_at,consumed_at").eq("code_hash", hashOpaque(code)).maybeSingle();
      const storedResource = data ? normalizeResource(data.resource) : "";
      if (
        error
        || !data
        || data.consumed_at
        || new Date(data.expires_at).getTime() <= Date.now()
        || data.client_id !== clientId
        || data.redirect_uri !== redirectUri
        || (requestedResource && requestedResource !== storedResource)
        || !safeEqual(pkceChallenge(verifier), data.code_challenge)
      ) return oauthError("invalid_grant", "Le code d'autorisation est invalide, expiré ou ne correspond pas au client.");
      const consumed = await supabase.from("oauth_authorization_codes").update({ consumed_at: new Date().toISOString() }).eq("code_hash", data.code_hash).is("consumed_at", null).select("code_hash").maybeSingle();
      if (consumed.error || !consumed.data) return oauthError("invalid_grant", "Le code d'autorisation a déjà été utilisé.");
      return issueTokens(supabase, data.user_id, clientId, data.resource, data.scope);
    }

    if (grantType === "refresh_token") {
      const refreshToken = String(form.get("refresh_token") ?? "");
      if (!refreshToken) return oauthError("invalid_request", "refresh_token est obligatoire.");
      const requestedResource = normalizeResource(String(form.get("resource") ?? ""));
      const { data, error } = await supabase.from("oauth_refresh_tokens").select("token_hash,client_id,user_id,resource,scope,expires_at,used_at,revoked_at").eq("token_hash", hashOpaque(refreshToken)).maybeSingle();
      if (
        error
        || !data
        || data.client_id !== clientId
        || data.used_at
        || data.revoked_at
        || new Date(data.expires_at).getTime() <= Date.now()
        || (requestedResource && requestedResource !== normalizeResource(data.resource))
      ) return oauthError("invalid_grant", "Le refresh token est invalide, expiré ou déjà utilisé.");
      const rotated = await supabase.from("oauth_refresh_tokens").update({ used_at: new Date().toISOString(), revoked_at: new Date().toISOString() }).eq("token_hash", data.token_hash).is("used_at", null).is("revoked_at", null).select("token_hash").maybeSingle();
      if (rotated.error || !rotated.data) return oauthError("invalid_grant", "Le refresh token a déjà été utilisé.");
      return issueTokens(supabase, data.user_id, clientId, data.resource, data.scope);
    }
  } catch (error) {
    console.error("OAuth token grant failed:", error instanceof Error ? error.message : "Unknown error");
    return oauthError("server_error", "Le service de jetons est temporairement indisponible.", 503);
  }

  return oauthError("unsupported_grant_type", "Grant OAuth non supporté.");
}

async function issueTokens(supabase: ReturnType<typeof getSupabaseAdminClient>, userId: string, clientId: string, resource: string, scope: string) {
  const accessToken = createOpaque("sf_at");
  const refreshToken = createOpaque("sf_rt");
  const now = Date.now();
  const { error: accessError } = await supabase.from("oauth_access_tokens").insert({ token_hash: hashOpaque(accessToken), client_id: clientId, user_id: userId, resource, scope, expires_at: new Date(now + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString() });
  if (accessError) return oauthError("server_error", "Impossible de créer le jeton d'accès.", 500);
  const { error: refreshError } = await supabase.from("oauth_refresh_tokens").insert({ token_hash: hashOpaque(refreshToken), client_id: clientId, user_id: userId, resource, scope, expires_at: new Date(now + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString() });
  if (refreshError) return oauthError("server_error", "Impossible de créer le refresh token.", 500);
  return tokenResponse(accessToken, refreshToken, scope);
}

export function OPTIONS() {
  return oauthJson(null, 204);
}
