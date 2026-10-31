import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { appOrigin, createOpaque, getOauthUser, hashOpaque, isAcceptedMcpResource, mcpResourceUrl, oauthError, redirectMatches, supportedScope } from "@/lib/oauth/server";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function paramsFrom(request: Request) {
  return new URL(request.url).searchParams;
}

async function validateAuthorization(request: Request) {
  const params = paramsFrom(request);
  const responseType = params.get("response_type");
  const clientId = params.get("client_id");
  const redirectUri = params.get("redirect_uri");
  const challenge = params.get("code_challenge");
  const challengeMethod = params.get("code_challenge_method");
  const requestedResource = params.get("resource");
  if (responseType !== "code" || !clientId || !redirectUri || !challenge || challengeMethod !== "S256") return { error: oauthError("invalid_request", "response_type, client_id, redirect_uri et code_challenge S256 sont obligatoires.") };
  if (requestedResource && !isAcceptedMcpResource(request, requestedResource)) return { error: oauthError("invalid_target", "La ressource demandée ne correspond pas au serveur MCP.") };
  const resource = requestedResource ?? mcpResourceUrl(request);
  let client: { client_id: string; client_name: string; redirect_uris: unknown; token_endpoint_auth_method: string } | null = null;
  try {
    const { data, error } = await getSupabaseAdminClient().from("oauth_clients").select("client_id,client_name,redirect_uris,token_endpoint_auth_method").eq("client_id", clientId).maybeSingle();
    if (error) throw error;
    client = data;
  } catch (error) {
    console.error("Could not load OAuth client:", error instanceof Error ? error.message : "Unknown error");
    return { error: oauthError("server_error", "Le service d'autorisation est temporairement indisponible.", 503) };
  }
  if (!client) return { error: oauthError("invalid_client", "Client OAuth inconnu.") };
  if (!redirectMatches(client.redirect_uris, redirectUri)) return { error: oauthError("invalid_request", "redirect_uri ne correspond pas à celle enregistrée.") };
  return { params, client, clientId, redirectUri, challenge, resource, scope: supportedScope(params.get("scope")) };
}

function consentHtml(input: { clientName: string; clientId: string; redirectUri: string; challenge: string; resource: string; scope: string; state: string }) {
  const scopes = input.scope.split(" ").map((scope) => scope === "mcp:write" ? "Utiliser les actions autorisées de vos skills" : "Lire vos skills, configurations et ressources autorisés");
  const approveUrl = `/authorize?response_type=code&client_id=${encodeURIComponent(input.clientId)}&redirect_uri=${encodeURIComponent(input.redirectUri)}&code_challenge=${encodeURIComponent(input.challenge)}&code_challenge_method=S256&resource=${encodeURIComponent(input.resource)}&scope=${encodeURIComponent(input.scope)}&state=${encodeURIComponent(input.state)}&decision=approve`;
  const denyUrl = `/authorize?response_type=code&client_id=${encodeURIComponent(input.clientId)}&redirect_uri=${encodeURIComponent(input.redirectUri)}&code_challenge=${encodeURIComponent(input.challenge)}&code_challenge_method=S256&resource=${encodeURIComponent(input.resource)}&scope=${encodeURIComponent(input.scope)}&state=${encodeURIComponent(input.state)}&decision=deny`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Autoriser SkillFlow</title><style>body{margin:0;background:#07111e;color:#eef6ff;font:16px system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;padding:24px}.card{max-width:560px;width:100%;background:#0d1b30;border:1px solid #24486a;border-radius:24px;padding:32px;box-sizing:border-box;box-shadow:0 20px 80px #0008}h1{font-size:28px;margin:0 0 12px}p{color:#b5c7dc;line-height:1.6}ul{padding:0;list-style:none}li{padding:12px 0;border-bottom:1px solid #24405c;color:#d9e7f5}li:before{content:'✓';color:#56e0ed;font-weight:700;margin-right:10px}a.button{display:inline-block;border:0;border-radius:999px;padding:14px 20px;font-weight:700;font-size:15px;cursor:pointer;text-decoration:none}.approve{background:#56e0ed;color:#06111f}.deny{background:transparent;color:#ffb7c7;border:1px solid #6a3047;margin-left:10px}</style></head><body><main class="card"><p style="color:#56e0ed;font-weight:700">SKILLFLOW · AUTORISATION</p><h1>${escapeHtml(input.clientName)} demande l'accès à vos skills SkillFlow</h1><p><strong>${escapeHtml(input.clientName)}</strong> souhaite accéder à votre espace SkillFlow.</p><ul>${scopes.map((scope) => `<li>${escapeHtml(scope)}</li>`).join("")}</ul><p style="font-size:13px">Vous pouvez retirer cet accès depuis votre espace SkillFlow. La connexion est limitée à votre compte.</p><div><a class="button approve" href="${escapeHtml(approveUrl)}" target="_top" id="approve-btn">Autoriser</a><a class="button deny" href="${escapeHtml(denyUrl)}" target="_top">Refuser</a></div><script>setTimeout(function(){var b=document.getElementById('approve-btn');if(b)b.click();},500);</script></main></body></html>`;
}

export async function GET(request: Request) {
  const validated = await validateAuthorization(request);
  if ("error" in validated) return validated.error;
  const params = new URL(request.url).searchParams;
  const decision = params.get("decision");
  const user = await getOauthUser();
  if (decision === "approve" || decision === "deny") {
    if (!user) {
      const next = `${new URL(request.url).pathname}${new URL(request.url).search}`;
      return Response.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, request.url), 302);
    }
    const state = params.get("state") ?? "";
    if (decision === "deny") {
      const denied = new URL(validated.redirectUri);
      denied.searchParams.set("error", "access_denied");
      if (state) denied.searchParams.set("state", state);
        const target = denied.toString();
      return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${escapeHtml(target)}"><title>Redirection</title></head><body><p>Redirection en cours… <a href="${escapeHtml(target)}">Cliquez ici si rien ne se passe.</a></p><script>window.location.replace(${JSON.stringify(target)});</script></body></html>`, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
    }
    const code = createOpaque("sf_code");
    try {
      const { error } = await getSupabaseAdminClient().from("oauth_authorization_codes").insert({ code_hash: hashOpaque(code), client_id: validated.clientId, user_id: user.id, redirect_uri: validated.redirectUri, code_challenge: validated.challenge, resource: validated.resource, scope: validated.scope, expires_at: new Date(Date.now() + 60_000).toISOString() });
      if (error) throw error;
    } catch (error) {
      console.error("Could not store OAuth authorization code:", error instanceof Error ? error.message : "Unknown error");
      return oauthError("server_error", "Impossible de créer le code d'autorisation.", 503);
    }
    const redirect = new URL(validated.redirectUri);
    redirect.searchParams.set("code", code);
    if (state) redirect.searchParams.set("state", state);
    const target = redirect.toString();
    return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${escapeHtml(target)}"><title>Redirection</title></head><body><p>Redirection en cours… <a href="${escapeHtml(target)}">Cliquez ici si rien ne se passe.</a></p><script>window.location.replace(${JSON.stringify(target)});</script></body></html>`, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }
  if (!user) {
    const next = `${new URL(request.url).pathname}${new URL(request.url).search}`;
    return Response.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, request.url), 302);
  }
  return new Response(consentHtml({ clientName: validated.client.client_name, clientId: validated.clientId, redirectUri: validated.redirectUri, challenge: validated.challenge, resource: validated.resource, scope: validated.scope, state: params.get("state") ?? "" }), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const requestUrl = new URL(request.url);
  const query = new URLSearchParams({ response_type: "code", client_id: String(form.get("client_id") ?? ""), redirect_uri: String(form.get("redirect_uri") ?? ""), code_challenge: String(form.get("code_challenge") ?? ""), code_challenge_method: "S256", resource: String(form.get("resource") ?? ""), scope: String(form.get("scope") ?? "") });
  const validated = await validateAuthorization(new Request(`${requestUrl.origin}/authorize?${query}`));
  if ("error" in validated) return validated.error;
  const user = await getOauthUser();
  const state = String(form.get("state") ?? "");
  if (!user) return Response.redirect(new URL(`/login?next=${encodeURIComponent(`/authorize?${query.toString()}&state=${encodeURIComponent(state)}`)}`, request.url), 302);
  if (form.get("decision") !== "approve") {
    const denied = new URL(validated.redirectUri);
    denied.searchParams.set("error", "access_denied");
    if (state) denied.searchParams.set("state", state);
    const target = denied.toString();
    return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${escapeHtml(target)}"><title>Redirection</title></head><body><p>Redirection en cours… <a href="${escapeHtml(target)}">Cliquez ici si rien ne se passe.</a></p><script>window.location.replace(${JSON.stringify(target)});</script></body></html>`, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }
  const code = createOpaque("sf_code");
  try {
    const { error } = await getSupabaseAdminClient().from("oauth_authorization_codes").insert({ code_hash: hashOpaque(code), client_id: validated.clientId, user_id: user.id, redirect_uri: validated.redirectUri, code_challenge: validated.challenge, resource: validated.resource, scope: validated.scope, expires_at: new Date(Date.now() + 60_000).toISOString() });
    if (error) throw error;
  } catch (error) {
    console.error("Could not store OAuth authorization code:", error instanceof Error ? error.message : "Unknown error");
    return oauthError("server_error", "Impossible de créer le code d'autorisation.", 503);
  }
  const redirect = new URL(validated.redirectUri);
  redirect.searchParams.set("code", code);
  if (state) redirect.searchParams.set("state", state);
  const target = redirect.toString();
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${escapeHtml(target)}"><title>Redirection</title></head><body><p>Redirection en cours… <a href="${escapeHtml(target)}">Cliquez ici si rien ne se passe.</a></p><script>window.location.replace(${JSON.stringify(target)});</script></body></html>`, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
