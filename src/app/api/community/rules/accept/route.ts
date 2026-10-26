import { NextResponse } from "next/server";
import { getCommunitySession, isSameOriginRequest } from "@/lib/community/server";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Requête non autorisée." }, { status: 403 });
  const context = await getCommunitySession();
  if (!context) return NextResponse.json({ error: "Connectez-vous pour continuer." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  const { version, displayName } = body as { version?: unknown; displayName?: unknown };
  if (typeof version !== "string" || typeof displayName !== "string" || displayName.trim().length < 1 || displayName.trim().length > 60) {
    return NextResponse.json({ error: "Indiquez un nom de 1 à 60 caractères." }, { status: 400 });
  }
  const { error } = await context.supabase.rpc("accept_community_rules", {
    p_version: version,
    p_display_name: displayName.trim(),
  });
  if (error) {
    console.error("Could not accept community rules:", error.message);
    return NextResponse.json({ error: "Impossible d’enregistrer votre acceptation. Réessayez." }, { status: 400 });
  }
  return NextResponse.json({ accepted: true });
}
