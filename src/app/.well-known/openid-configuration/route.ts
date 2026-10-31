// Some MCP clients fall back to OpenID Connect discovery when RFC 8414 metadata
// is unavailable. Serving the same document keeps that fallback working.
export { GET, OPTIONS } from "../oauth-authorization-server/route";
