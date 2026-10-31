import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { createOpaque, hashOpaque, isAllowedRedirectUri, oauthError, oauthJson } from "@/lib/oauth/server";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return oauthError("invalid_request", "Le corps JSON est invalide.");
  }
  const clientName = typeof body.client_name === "string" ? body.client_name.trim().slice(0, 120) : "MCP client";
  const redirectUris = body.redirect_uris;
  const grantTypes = Array.isArray(body.grant_types) ? body.grant_types.filter((value): value is string => typeof value === "string") : [];
  const responseTypes = Array.isArray(body.response_types) ? body.response_types.filter((value): value is string => typeof value === "string") : [];
  const authMethod = body.token_endpoint_auth_method === "client_secret_post" ? "client_secret_post" : "none";
  if (!Array.isArray(redirectUris) || redirectUris.length === 0 || redirectUris.length > 10 || !redirectUris.every((value) => typeof value === "string" && isAllowedRedirectUri(value))) {
    return oauthError("invalid_redirect_uri", "Toutes les URL de redirection doivent être HTTPS, ou localhost en développement.");
  }
  if (grantTypes.length && grantTypes.some((value) => !["authorization_code", "refresh_token"].includes(value))) return oauthError("invalid_client_metadata", "Type de grant non supporté.");
  if (responseTypes.length && responseTypes.some((value) => value !== "code")) return oauthError("invalid_client_metadata", "Type de réponse non supporté.");
  const clientId = createOpaque("sf_client");
  const clientSecret = authMethod === "client_secret_post" ? createOpaque("sf_secret") : null;
  const uniqueRedirectUris = Array.from(new Set(redirectUris as string[]));
  try {
    const { error } = await getSupabaseAdminClient().from("oauth_clients").insert({
      client_id: clientId,
      client_secret_hash: clientSecret ? hashOpaque(clientSecret) : null,
      client_name: clientName || "MCP client",
      redirect_uris: uniqueRedirectUris,
      grant_types: grantTypes.length ? grantTypes : ["authorization_code", "refresh_token"],
      response_types: responseTypes.length ? responseTypes : ["code"],
      token_endpoint_auth_method: authMethod,
    });
    if (error) throw error;
  } catch (error) {
    console.error("Could not register OAuth client:", error instanceof Error ? error.message : "Unknown error");
    return oauthError("server_error", "Impossible d'enregistrer le client.", 503);
  }
  return oauthJson({ client_id: clientId, ...(clientSecret ? { client_secret: clientSecret } : {}), client_name: clientName, redirect_uris: uniqueRedirectUris, grant_types: grantTypes.length ? grantTypes : ["authorization_code", "refresh_token"], response_types: responseTypes.length ? responseTypes : ["code"], token_endpoint_auth_method: authMethod }, 201);
}

export function OPTIONS() {
  return oauthJson(null, 204);
}
