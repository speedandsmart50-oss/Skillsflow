import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { recordAdminAction, requireAdminApiUser } from "@/lib/security/admin-api";

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const FORMATS = new Set(["claude", "chatgpt", "archive"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ skillId: string }> },
) {
  const access = await requireAdminApiUser(request);
  if (!access.ok) return access.response;

  const { skillId } = await params;
  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Le fichier envoyé est invalide." }, { status: 400 });
  }

  const version = form.get("version");
  const format = form.get("format");
  const file = form.get("file");
  const publish = form.get("publish") === "true";
  const releaseNotes = form.get("releaseNotes");

  if (
    typeof version !== "string"
    || !VERSION_PATTERN.test(version)
    || typeof format !== "string"
    || !FORMATS.has(format)
    || !(file instanceof File)
    || file.size === 0
    || file.size > MAX_FILE_SIZE
    || (releaseNotes !== null && typeof releaseNotes !== "string")
    || (typeof releaseNotes === "string" && releaseNotes.length > 2000)
  ) {
    return NextResponse.json({ error: "Vérifiez la version, le format et la taille du fichier (4 Mo maximum)." }, { status: 400 });
  }

  const { data: skill, error: skillError } = await access.supabase
    .from("products")
    .select("id, slug, archived_at")
    .eq("id", skillId)
    .maybeSingle();
  if (skillError) {
    console.error("Could not load skill for version upload:", skillError.message);
    return NextResponse.json({ error: "Impossible de charger ce skill." }, { status: 500 });
  }
  if (!skill) return NextResponse.json({ error: "Skill introuvable." }, { status: 404 });
  if (skill.archived_at && publish) {
    return NextResponse.json({ error: "Désarchivez le skill avant de publier une version." }, { status: 409 });
  }

  const suppliedName = file.name.toLowerCase();
  const extension = suppliedName.split(".").pop() ?? "";
  if (
    (format === "archive" && extension !== "zip")
    || (format !== "archive" && extension !== "md" && extension !== "txt")
  ) {
    return NextResponse.json({
      error: format === "archive"
        ? "Le pack complet doit être un fichier ZIP."
        : "Le fichier Claude ou ChatGPT doit être au format Markdown ou texte.",
    }, { status: 400 });
  }

  const fileContent = Buffer.from(await file.arrayBuffer());
  if (format === "archive" && fileContent.subarray(0, 2).toString("ascii") !== "PK") {
    return NextResponse.json({ error: "Le fichier ne semble pas être une archive ZIP valide." }, { status: 400 });
  }

  const existingResult = await access.supabase
    .from("skill_versions")
    .select("id, status, published_at, release_notes, claude_file_path, chatgpt_file_path, archive_path")
    .eq("product_id", skill.id)
    .eq("version", version)
    .maybeSingle();
  if (existingResult.error) {
    console.error("Could not check existing skill version:", existingResult.error.message);
    return NextResponse.json({ error: "Impossible de charger la version demandée." }, { status: 500 });
  }

  const path = `${skill.slug}/${version}/${format}-${randomUUID()}.${extension}`;
  const contentType = format === "archive"
    ? "application/zip"
    : extension === "md"
      ? "text/markdown"
      : "text/plain";

  try {
    await recordAdminAction(access.supabase, access.user.id, "catalog.skill_version.upload", "skill_version", existingResult.data?.id ?? null, "requested", {
      skillId: skill.id,
      version,
      format,
      fileSize: file.size,
      publish,
    });
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : "Impossible d’enregistrer cette action." }, { status: 500 });
  }

  const { error: uploadError } = await access.supabase.storage
    .from("product-packs")
    .upload(path, fileContent, { contentType, upsert: false });
  if (uploadError) {
    console.error("Could not upload skill file:", uploadError.message);
    return NextResponse.json({ error: "Le fichier n’a pas pu être envoyé au stockage privé." }, { status: 503 });
  }

  const fileField = format === "claude"
    ? "claude_file_path"
    : format === "chatgpt"
      ? "chatgpt_file_path"
      : "archive_path";
  const nextStatus = publish ? "published" : existingResult.data?.status ?? "draft";
  const versionValues: Record<string, unknown> = {
    product_id: skill.id,
    version,
    [fileField]: path,
    status: nextStatus,
    release_notes: typeof releaseNotes === "string"
      ? releaseNotes.trim() || existingResult.data?.release_notes || null
      : existingResult.data?.release_notes ?? null,
    published_at: publish
      ? existingResult.data?.published_at ?? new Date().toISOString()
      : existingResult.data?.published_at ?? null,
  };

  const versionWrite = existingResult.data
    ? await access.supabase
      .from("skill_versions")
      .update(versionValues)
      .eq("id", existingResult.data.id)
      .select("id, product_id, version, release_notes, status, published_at, created_at")
      .single()
    : await access.supabase
      .from("skill_versions")
      .insert(versionValues)
      .select("id, product_id, version, release_notes, status, published_at, created_at")
      .single();

  if (versionWrite.error) {
    console.error("Could not save skill version:", versionWrite.error.message);
    const { error: cleanupError } = await access.supabase.storage.from("product-packs").remove([path]);
    if (cleanupError) {
      console.error("Could not remove orphaned skill file:", cleanupError.message);
      return NextResponse.json({
        error: "La version n’a pas pu être enregistrée et le fichier temporaire n’a pas pu être supprimé.",
      }, { status: 500 });
    }
    return NextResponse.json({ error: "La version n’a pas pu être enregistrée. Le fichier envoyé a été supprimé." }, { status: 500 });
  }

  if (format === "archive" && publish) {
    const { error: productUpdateError } = await access.supabase
      .from("products")
      .update({ version, zip_path: path, status: "published", updated_at: new Date().toISOString() })
      .eq("id", skill.id);
    if (productUpdateError) {
      console.error("Could not update skill archive pointer:", productUpdateError.message);
      return NextResponse.json({ error: "La version est publiée, mais le pack de paiement n’a pas été mis à jour." }, { status: 500 });
    }
  }

  try {
    await recordAdminAction(access.supabase, access.user.id, "catalog.skill_version.upload", "skill_version", versionWrite.data.id, "completed", {
      skillId: skill.id,
      version,
      format,
      fileSize: file.size,
      status: versionWrite.data.status,
    });
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : "Le journal d’audit n’a pas pu confirmer l’action." }, { status: 500 });
  }

  return NextResponse.json({ version: versionWrite.data }, {
    status: existingResult.data ? 200 : 201,
    headers: { "Cache-Control": "private, no-store" },
  });
}
