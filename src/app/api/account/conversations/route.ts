import { NextResponse } from "next/server";

import { consumeApiRateLimit } from "@/lib/security/api-rate-limit";
import { matchesFileContentType } from "@/lib/security/file-content";
import { getAuthenticatedUser, getSupabaseAdminClient } from "@/lib/supabase/server";

const BUCKET = "agent-conversations";
const MAX_BODY_BYTES = 150_000;
const MAX_SCREENSHOTS = 6;
const MAX_IMAGE_BYTES = 7 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIME_BY_EXTENSION = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readLimitedJson(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
    throw new Error("unsupported_content_type");
  }
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) throw new Error("body_too_large");

  const reader = request.body?.getReader();
  if (!reader) throw new Error("empty_body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error("body_too_large");
    }
    chunks.push(value);
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
}

function anonymizeConversation(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]")
    .replace(/(?:\+?\d[\d .()/-]{7,}\d)/g, "[TÉLÉPHONE]")
    .replace(/https?:\/\/\S+/gi, "[LIEN]");
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Reconnectez-vous pour envoyer un exemple." }, { status: 401 });

  let body: unknown;
  try {
    body = await readLimitedJson(request);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "invalid_body";
    const status = reason === "body_too_large" ? 413 : 400;
    return NextResponse.json({ error: status === 413 ? "L’exemple est trop volumineux." : "Le formulaire est invalide." }, { status });
  }

  if (
    !isRecord(body)
    || typeof body.id !== "string"
    || !UUID_PATTERN.test(body.id)
    || typeof body.title !== "string"
    || body.title.trim().length < 1
    || body.title.trim().length > 120
    || typeof body.conversation !== "string"
    || body.conversation.trim().length < 20
    || body.conversation.trim().length > 30_000
    || !Array.isArray(body.screenshotPaths)
    || body.screenshotPaths.length > MAX_SCREENSHOTS
    || body.screenshotPaths.some((path) => typeof path !== "string")
  ) {
    return NextResponse.json({ error: "Vérifiez le titre, la conversation et les captures." }, { status: 400 });
  }

  const screenshotPaths = body.screenshotPaths as string[];
  const seenIndexes = new Set<string>();
  for (const path of screenshotPaths) {
    const parts = path.split("/");
    const fileMatch = parts.length === 3 && parts[2].match(/^([1-6])\.(jpg|png|webp)$/);
    if (parts[0] !== user.id || parts[1] !== body.id || !fileMatch || seenIndexes.has(fileMatch[1])) {
      return NextResponse.json({ error: "Une capture ne correspond pas à cet exemple." }, { status: 400 });
    }
    seenIndexes.add(fileMatch[1]);
  }

  let supabase: ReturnType<typeof getSupabaseAdminClient>;
  try {
    supabase = getSupabaseAdminClient();
  } catch {
    return NextResponse.json({ error: "Le service d’enregistrement est temporairement indisponible." }, { status: 503 });
  }

  let limit;
  try {
    limit = await consumeApiRateLimit(supabase, "conversation_user", `user:${user.id}`);
  } catch (error) {
    console.error("Conversation rate limit check failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Le service d’enregistrement est temporairement indisponible." }, { status: 503 });
  }
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Trop d’exemples envoyés. Réessayez plus tard." },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(Math.max(1, limit.retryAfterSeconds)) } },
    );
  }

  for (const path of screenshotPaths) {
    const extension = path.split("/")[2].split(".")[1] as keyof typeof MIME_BY_EXTENSION;
    const { data: file, error: downloadError } = await supabase.storage.from(BUCKET).download(path);
    if (downloadError || !file) {
      return NextResponse.json({ error: "Une capture est introuvable dans votre espace privé." }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
      await supabase.storage.from(BUCKET).remove(screenshotPaths);
      return NextResponse.json({ error: "Une capture dépasse la taille autorisée." }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!matchesFileContentType(bytes, MIME_BY_EXTENSION[extension])) {
      await supabase.storage.from(BUCKET).remove(screenshotPaths);
      return NextResponse.json({ error: "Le contenu d’une capture ne correspond pas à son format d’image." }, { status: 400 });
    }
  }

  const conversationId = body.id;
  const { data: conversation, error: insertError } = await supabase
    .from("agent_conversations")
    .insert({
      id: conversationId,
      user_id: user.id,
      title: body.title.trim(),
      conversation_text: anonymizeConversation(body.conversation.trim()),
      screenshot_paths: [],
    })
    .select("id, title, conversation_text, screenshot_paths, created_at")
    .single();

  if (insertError || !conversation) {
    console.error("Could not create conversation example:", insertError?.message ?? "No row returned");
    await supabase.storage.from(BUCKET).remove(screenshotPaths);
    return NextResponse.json({ error: "Votre exemple n’a pas pu être enregistré." }, { status: 500 });
  }

  if (screenshotPaths.length) {
    const { error: registryError } = await supabase.from("agent_conversation_screenshots").insert(
      screenshotPaths.map((storagePath) => ({
        user_id: user.id,
        conversation_id: conversationId,
        storage_path: storagePath,
      })),
    );
    if (registryError) {
      console.error("Could not register verified conversation screenshots:", registryError.message);
      await supabase.from("agent_conversations").delete().eq("id", conversationId).eq("user_id", user.id);
      await supabase.storage.from(BUCKET).remove(screenshotPaths);
      return NextResponse.json({ error: "Les captures n’ont pas pu être vérifiées." }, { status: 500 });
    }

    const { data: updatedConversation, error: updateError } = await supabase
      .from("agent_conversations")
      .update({ screenshot_paths: screenshotPaths })
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .select("id, title, conversation_text, screenshot_paths, created_at")
      .single();
    if (updateError || !updatedConversation) {
      console.error("Could not attach verified screenshots:", updateError?.message ?? "No row returned");
      await supabase.from("agent_conversations").delete().eq("id", conversationId).eq("user_id", user.id);
      await supabase.storage.from(BUCKET).remove(screenshotPaths);
      return NextResponse.json({ error: "Les captures n’ont pas pu être associées à l’exemple." }, { status: 500 });
    }

    return NextResponse.json({ conversation: updatedConversation }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  }

  return NextResponse.json({ conversation }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
