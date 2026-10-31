import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { hashOpaque, oauthError, oauthJson } from "@/lib/oauth/server";

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return oauthError("invalid_request", "Le corps de la requête doit être encodé en formulaire.");
  }
  const token = String(form.get("token") ?? "");
  const clientId = String(form.get("client_id") ?? "");
  if (!token) return oauthError("invalid_request", "token est obligatoire.");
  const hash = hashOpaque(token);
  try {
    const supabase = getSupabaseAdminClient();
    const revokeAccess = supabase.from("oauth_access_tokens").update({ revoked_at: new Date().toISOString() }).eq("token_hash", hash);
    const revokeRefresh = supabase.from("oauth_refresh_tokens").update({ revoked_at: new Date().toISOString() }).eq("token_hash", hash);
    await Promise.all([
      clientId ? revokeAccess.eq("client_id", clientId) : revokeAccess,
      clientId ? revokeRefresh.eq("client_id", clientId) : revokeRefresh,
    ]);
  } catch (error) {
    console.error("Could not revoke OAuth token:", error instanceof Error ? error.message : "Unknown error");
    return oauthError("server_error", "Le service de révocation est temporairement indisponible.", 503);
  }
  return oauthJson({}, 200);
}

export function OPTIONS() {
  return oauthJson(null, 204);
}
