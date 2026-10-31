import { appOrigin, mcpResourceUrl, oauthJson } from "@/lib/oauth/server";

export function GET(request: Request) {
  return oauthJson({
    resource: mcpResourceUrl(request),
    authorization_servers: [appOrigin(request)],
    bearer_methods_supported: ["header"],
    scopes_supported: ["mcp:read", "mcp:write"],
  });
}

export function OPTIONS() {
  return oauthJson(null, 204);
}
