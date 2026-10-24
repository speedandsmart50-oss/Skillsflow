import { NextResponse } from "next/server";
import { createMcpKey } from "@/lib/security/mcp-keys";
import { getAuthenticatedUser, getSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Connectez-vous pour gérer votre clé MCP." }, { status: 401 });
  }

  const { data, error } = await getSupabaseAdminClient()
    .from("mcp_keys")
    .select("id, status, last_used_at, created_at, revoked_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Could not load MCP key status:", error.message);
    return NextResponse.json({ error: "Impossible de charger le statut de votre clé MCP." }, { status: 500 });
  }

  return NextResponse.json({ keys: data }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Connectez-vous pour créer une clé MCP." }, { status: 401 });
  }

  const { value: key, hash: keyHash } = createMcpKey();
  const { data: keyId, error } = await getSupabaseAdminClient()
    .rpc("rotate_mcp_key", { p_user_id: user.id, p_key_hash: keyHash });

  if (error || !keyId) {
    console.error("Could not rotate MCP key:", error?.message ?? "No key identifier returned");
    return NextResponse.json({ error: "Impossible de créer votre clé MCP." }, { status: 500 });
  }

  return NextResponse.json({
    key: {
      id: keyId,
      value: key,
      status: "active",
      createdAt: new Date().toISOString(),
    },
  }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Connectez-vous pour révoquer votre clé MCP." }, { status: 401 });
  }

  const { error } = await getSupabaseAdminClient()
    .from("mcp_keys")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("status", "active");

  if (error) {
    console.error("Could not revoke MCP keys:", error.message);
    return NextResponse.json({ error: "Impossible de révoquer votre clé MCP." }, { status: 500 });
  }

  return NextResponse.json({ revoked: true });
}
