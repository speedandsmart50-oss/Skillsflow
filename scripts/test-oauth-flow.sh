#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://localhost:3000}"
REDIRECT_URI="${REDIRECT_URI:-http://localhost:8765/callback}"

echo "== 1. MCP sans token (attendu: 401) =="
curl -i -sS -X POST "$BASE/mcp" -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"oauth-test","version":"1.0"}}}' | sed -n '1,14p'

echo "== 2. Métadonnées =="
curl -fsS "$BASE/.well-known/oauth-protected-resource"; echo
curl -fsS "$BASE/.well-known/oauth-authorization-server"; echo

echo "== 3. Enregistrement =="
CLIENT_JSON=$(curl -fsS -X POST "$BASE/register" -H 'Content-Type: application/json' -d "{\"client_name\":\"manual-test\",\"redirect_uris\":[\"$REDIRECT_URI\"],\"grant_types\":[\"authorization_code\",\"refresh_token\"],\"response_types\":[\"code\"],\"token_endpoint_auth_method\":\"none\"}")
echo "$CLIENT_JSON"
CLIENT_ID=$(printf '%s' "$CLIENT_JSON" | jq -r .client_id)

CODE_VERIFIER=$(openssl rand -base64 48 | tr -d '=+/' | cut -c1-64)
CODE_CHALLENGE=$(printf %s "$CODE_VERIFIER" | openssl dgst -binary -sha256 | openssl base64 -A | tr '+/' '-_' | tr -d '=')
RESOURCE="$BASE/mcp"

echo "== 4. URL d'autorisation =="
AUTH_URL="$BASE/authorize?response_type=code&client_id=$CLIENT_ID&redirect_uri=$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$REDIRECT_URI")&code_challenge=$CODE_CHALLENGE&code_challenge_method=S256&state=xyz123&scope=mcp:read&resource=$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$RESOURCE")"
echo "$AUTH_URL"
echo "Le navigateur doit ouvrir cette URL, puis valider la connexion et le consentement."
echo "Après redirection, lancer: CODE=... ./scripts/test-oauth-flow.sh --exchange"

if [[ "${1:-}" == "--exchange" ]]; then
  : "${CODE:?Définir CODE avec le code reçu dans l'URL de callback}"
  TOKEN_JSON=$(curl -fsS -X POST "$BASE/token" -H 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode grant_type=authorization_code --data-urlencode "code=$CODE" --data-urlencode "redirect_uri=$REDIRECT_URI" \
    --data-urlencode "client_id=$CLIENT_ID" --data-urlencode "code_verifier=$CODE_VERIFIER" --data-urlencode "resource=$RESOURCE")
  echo "$TOKEN_JSON"
  ACCESS_TOKEN=$(printf '%s' "$TOKEN_JSON" | jq -r .access_token)
  curl -i -sS -X POST "$BASE/mcp" -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
fi
