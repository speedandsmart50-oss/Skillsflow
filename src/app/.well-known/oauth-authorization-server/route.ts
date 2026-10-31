import { appOrigin, oauthJson } from "@/lib/oauth/server";

export function GET(request: Request) {
  const origin = appOrigin(request);
  return oauthJson({
    issuer: origin,
    authorization_endpoint: `${origin}/authorize`,
    token_endpoint: `${origin}/token`,
    registration_endpoint: `${origin}/register`,
    revocation_endpoint: `${origin}/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
    scopes_supported: ["mcp:read", "mcp:write"],
    authorization_response_iss_parameter_supported: true,
  });
}

export function OPTIONS() {
  return oauthJson(null, 204);
}
