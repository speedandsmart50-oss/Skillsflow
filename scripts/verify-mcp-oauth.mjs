#!/usr/bin/env node
/**
 * Vérifie le flux OAuth 2.1 + MCP de SkillFlow, de la découverte jusqu'à
 * l'appel d'outil, comme le fait un connecteur Claude.
 *
 *   node scripts/verify-mcp-oauth.mjs                 # diagnostic + URL d'autorisation
 *   node scripts/verify-mcp-oauth.mjs --wait          # attend le retour du navigateur
 *   node scripts/verify-mcp-oauth.mjs --exchange CODE # échange un code déjà reçu
 *
 * Options :
 *   --base URL        URL de l'application (défaut : BASE ou http://localhost:3000)
 *   --redirect URL    URL de redirection (défaut : http://localhost:8765/callback)
 *   --port N          port du serveur de rappel en mode --wait (défaut : 8765)
 *
 * Aucune dépendance externe. L'état du flux est conservé dans le dossier
 * temporaire du système, jamais dans le dépôt.
 */
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const BASE = option("--base", process.env.BASE ?? "http://localhost:3000").replace(/\/+$/, "");
const REDIRECT = option("--redirect", process.env.REDIRECT_URI ?? "http://localhost:8765/callback");
const PORT = Number(option("--port", "8765"));
const STATE_FILE = join(tmpdir(), "skillflow-mcp-oauth.json");
const RESOURCE = `${BASE}/mcp`;
const PROTOCOL_VERSION = "2025-06-18";

const pass = (label, detail = "") => console.log(`  OK    ${label}${detail ? ` — ${detail}` : ""}`);
const fail = (label, detail = "") => console.log(`  ERREUR ${label}${detail ? ` — ${detail}` : ""}`);
const step = (label) => console.log(`\n${label}`);

async function readJson(response) {
  const text = await response.text();
  try {
    return { json: JSON.parse(text), text };
  } catch {
    return { json: null, text };
  }
}

async function discover() {
  step("1. Découverte OAuth");

  const prmResponse = await fetch(`${BASE}/.well-known/oauth-protected-resource`);
  const prm = await readJson(prmResponse);
  if (!prmResponse.ok || !prm.json?.resource) {
    fail("métadonnées de la ressource", `HTTP ${prmResponse.status} ${prm.text.slice(0, 200)}`);
    process.exitCode = 1;
    return null;
  }
  pass("métadonnées de la ressource", prm.json.resource);

  if (prm.json.resource !== RESOURCE) {
    fail("resource annoncée différente de l'URL testée", `${prm.json.resource} ≠ ${RESOURCE}`);
    console.log("        → vérifiez NEXT_PUBLIC_MCP_RESOURCE_URL / NEXT_PUBLIC_APP_URL");
  }

  const issuer = prm.json.authorization_servers?.[0];
  if (!issuer) {
    fail("authorization_servers absent");
    process.exitCode = 1;
    return null;
  }

  const asResponse = await fetch(`${issuer}/.well-known/oauth-authorization-server`);
  const metadata = await readJson(asResponse);
  if (!asResponse.ok || !metadata.json?.token_endpoint) {
    fail("métadonnées du serveur d'autorisation", `HTTP ${asResponse.status} ${metadata.text.slice(0, 200)}`);
    process.exitCode = 1;
    return null;
  }
  pass("serveur d'autorisation", `${metadata.json.issuer} (token : ${metadata.json.token_endpoint})`);

  if (!metadata.json.code_challenge_methods_supported?.includes("S256")) fail("PKCE S256 non annoncé");
  if (metadata.json.token_endpoint_auth_methods_supported?.includes("none")) pass("clients publics (auth none) supportés");
  else fail("token_endpoint_auth_methods_supported n'inclut pas 'none'");

  return { issuer, metadata: metadata.json };
}

async function checkChallenge() {
  step("2. Défi d'authentification sur l'endpoint MCP");
  const response = await fetch(RESOURCE, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "skillflow-check", version: "1.0.0" } },
    }),
  });
  const challenge = response.headers.get("www-authenticate");
  if (response.status === 401 && challenge?.includes("resource_metadata")) pass("401 + WWW-Authenticate", challenge);
  else fail("défi OAuth", `HTTP ${response.status} ${challenge ?? "(aucun WWW-Authenticate)"}`);
}

async function registerClient() {
  step("3. Enregistrement dynamique du client");
  const response = await fetch(`${BASE}/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_name: "Claude connector check",
      redirect_uris: [REDIRECT],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });
  const body = await readJson(response);
  if (!response.ok || !body.json?.client_id) {
    fail("POST /register", `HTTP ${response.status} ${body.text.slice(0, 300)}`);
    process.exitCode = 1;
    return null;
  }
  pass("client créé", body.json.client_id);
  return body.json.client_id;
}

function authorizationUrl(clientId) {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = new URL(`${BASE}/authorize`);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: randomBytes(16).toString("hex"),
    scope: "mcp:read mcp:write",
    resource: RESOURCE,
  }).toString();
  writeFileSync(STATE_FILE, JSON.stringify({ base: BASE, clientId, verifier, redirect: REDIRECT, resource: RESOURCE }, null, 2));
  return url.toString();
}

async function exchange(clientId, verifier, code) {
  step("5. Échange du code contre des jetons");
  const response = await fetch(`${BASE}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT,
      client_id: clientId,
      code_verifier: verifier,
      resource: RESOURCE,
    }),
  });
  const body = await readJson(response);
  if (!response.ok || !body.json?.access_token) {
    fail("POST /token", `HTTP ${response.status} ${body.text.slice(0, 300)}`);
    console.log("        → le code expire en 60 s et ne peut servir qu'une fois");
    process.exitCode = 1;
    return null;
  }
  pass("jeton d'accès reçu", `expire dans ${body.json.expires_in}s`);
  return body.json;
}

async function callMcp(accessToken) {
  step("6. Appel MCP authentifié");
  const headers = {
    authorization: `Bearer ${accessToken}`,
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "mcp-protocol-version": PROTOCOL_VERSION,
  };
  const initResponse = await fetch(RESOURCE, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "skillflow-check", version: "1.0.0" } },
    }),
  });
  const init = await readJson(initResponse);
  if (!initResponse.ok) {
    fail("initialize", `HTTP ${initResponse.status} ${init.text.slice(0, 300)}`);
    process.exitCode = 1;
    return;
  }
  pass("initialize", init.json?.result?.serverInfo?.name ?? "");

  const listResponse = await fetch(RESOURCE, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
  });
  const list = await readJson(listResponse);
  const tools = list.json?.result?.tools;
  if (!listResponse.ok || !Array.isArray(tools)) {
    fail("tools/list", `HTTP ${listResponse.status} ${list.text.slice(0, 300)}`);
    process.exitCode = 1;
    return;
  }
  pass("tools/list", `${tools.length} outil(s) : ${tools.slice(0, 6).map((tool) => tool.name).join(", ")}${tools.length > 6 ? "…" : ""}`);
  console.log("\nFlux complet validé : Claude peut se connecter à ce serveur MCP.");
}

async function waitForCallback(clientId, verifier, url) {
  step("4. Autorisation dans le navigateur");
  console.log("  Ouvrez cette URL, connectez-vous puis acceptez :\n");
  console.log(`  ${url}\n`);
  console.log(`  En attente du retour sur ${REDIRECT} …`);
  const code = await new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      const target = new URL(request.url ?? "/", `http://127.0.0.1:${PORT}`);
      if (target.pathname !== new URL(REDIRECT).pathname) {
        response.writeHead(404).end("Not found");
        return;
      }
      const received = target.searchParams.get("code");
      const error = target.searchParams.get("error");
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(received
        ? "<h2>SkillFlow : autorisation accordée.</h2><p>Vous pouvez fermer cet onglet.</p>"
        : `<h2>SkillFlow : autorisation refusée.</h2><p>${error ?? "code absent"}</p>`);
      server.close();
      if (received) resolve(received);
      else reject(new Error(error ?? "code absent"));
    });
    server.listen(PORT, "127.0.0.1");
    server.setTimeout(5 * 60 * 1000);
  }).catch((error) => {
    fail("retour du navigateur", error.message);
    process.exitCode = 1;
    return null;
  });
  if (!code) return;
  pass("code d'autorisation reçu");
  const tokens = await exchange(clientId, verifier, code);
  if (tokens) await callMcp(tokens.access_token);
  rmSync(STATE_FILE, { force: true });
}

async function main() {
  console.log(`SkillFlow — vérification du connecteur MCP sur ${BASE}`);

  const discovery = await discover();
  if (!discovery) return;

  await checkChallenge();

  const providedCode = option("--exchange", null);
  if (providedCode) {
    if (!existsSync(STATE_FILE)) {
      fail("état du flux introuvable", STATE_FILE);
      console.log("        → relancez d'abord le script sans --exchange pour obtenir une URL d'autorisation.");
      process.exitCode = 1;
      return;
    }
    const state = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    const code = providedCode.includes("?") ? new URL(providedCode).searchParams.get("code") : providedCode;
    if (!code) {
      fail("code introuvable dans l'argument --exchange");
      process.exitCode = 1;
      return;
    }
    const tokens = await exchange(state.clientId, state.verifier, code);
    if (tokens) await callMcp(tokens.access_token);
    rmSync(STATE_FILE, { force: true });
    return;
  }

  const clientId = await registerClient();
  if (!clientId) return;
  const url = authorizationUrl(clientId);

  if (args.includes("--wait")) {
    await waitForCallback(clientId, JSON.parse(readFileSync(STATE_FILE, "utf8")).verifier, url);
    return;
  }

  step("4. Autorisation dans le navigateur");
  console.log("  Ouvrez cette URL, connectez-vous puis acceptez :\n");
  console.log(`  ${url}\n`);
  console.log("  Le code sera renvoyé sur :", REDIRECT);
  console.log("  Terminez ensuite avec : npm run mcp:verify -- --exchange \"<URL de retour>\"");
  console.log(`  (ou relancez avec --wait pour attendre automatiquement le retour)`);
}

await main();
