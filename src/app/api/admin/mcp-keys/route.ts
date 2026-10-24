import { NextResponse } from "next/server";
import { recordAdminAction, requireAdminApiUser } from "@/lib/security/admin-api";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: Request) {
  const access = await requireAdminApiUser(request);
  if (!access.ok) return access.response;

  const { data: keys, error } = await access.supabase
    .from("mcp_keys")
    .select("id, user_id, status, last_used_at, created_at, revoked_at")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) {
    console.error("Could not load MCP keys for admin:", error.message);
    return NextResponse.json({ error: "Impossible de charger les accès MCP." }, { status: 500 });
  }

  const userIds = [...new Set((keys ?? []).map((key) => key.user_id))];
  const { data: profiles, error: profileError } = userIds.length
    ? await access.supabase.from("profiles").select("id, email").in("id", userIds)
    : { data: [], error: null };
  if (profileError) {
    console.error("Could not load MCP key owners:", profileError.message);
    return NextResponse.json({ error: "Impossible de charger les propriétaires des clés." }, { status: 500 });
  }

  const emailsById = new Map((profiles ?? []).map((profile) => [profile.id, profile.email]));
  return NextResponse.json({
    keys: (keys ?? []).map((key) => ({ ...key, email: emailsById.get(key.user_id) ?? "Compte introuvable" })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const access = await requireAdminApiUser(request);
  if (!access.ok) return access.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "La demande est invalide." }, { status: 400 });
  }
  if (
    !isRecord(body)
    || typeof body.keyId !== "string"
    || !UUID_PATTERN.test(body.keyId)
    || body.confirmation !== "RÉVOQUER"
  ) {
    return NextResponse.json({ error: "Confirmez la révocation de cette clé." }, { status: 400 });
  }

  const { data: key, error: lookupError } = await access.supabase
    .from("mcp_keys")
    .select("id, user_id, status")
    .eq("id", body.keyId)
    .maybeSingle();
  if (lookupError) {
    console.error("Could not load MCP key for revocation:", lookupError.message);
    return NextResponse.json({ error: "Impossible de vérifier cette clé." }, { status: 500 });
  }
  if (!key) return NextResponse.json({ error: "Clé introuvable." }, { status: 404 });
  if (key.status !== "active") return NextResponse.json({ error: "Cette clé n’est plus active." }, { status: 409 });

  try {
    await recordAdminAction(access.supabase, access.user.id, "mcp_key.revoke", "mcp_key", key.id, "requested", {
      userId: key.user_id,
    });
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : "Impossible d’enregistrer cette action." }, { status: 500 });
  }

  const { error } = await access.supabase
    .from("mcp_keys")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", key.id)
    .eq("status", "active");
  if (error) {
    console.error("Could not revoke MCP key:", error.message);
    return NextResponse.json({ error: "Impossible de révoquer cette clé." }, { status: 500 });
  }

  try {
    await recordAdminAction(access.supabase, access.user.id, "mcp_key.revoke", "mcp_key", key.id, "completed", {
      userId: key.user_id,
    });
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : "Le journal d’audit n’a pas pu confirmer l’action." }, { status: 500 });
  }
  return NextResponse.json({ revoked: true });
}
