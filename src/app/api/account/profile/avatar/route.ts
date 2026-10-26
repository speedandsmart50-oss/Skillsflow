import { NextResponse } from "next/server";
import { getAuthenticatedUser, getSupabaseAdminClient } from "@/lib/supabase/server";

const MAX_AVATAR_BYTES = 3 * 1024 * 1024;
const signatures: Record<string, (bytes: Uint8Array) => boolean> = {
  "image/jpeg": (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  "image/png": (bytes) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47,
  "image/webp": (bytes) => String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP",
};

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Connectez-vous pour modifier votre photo." }, { status: 401 });

  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Le fichier envoyé est invalide." }, { status: 400 }); }
  const file = form.get("avatar");
  if (!(file instanceof File)) return NextResponse.json({ error: "Sélectionnez une photo." }, { status: 400 });
  if (file.size < 1 || file.size > MAX_AVATAR_BYTES) return NextResponse.json({ error: "La photo doit peser 3 Mo maximum." }, { status: 400 });
  const verifySignature = signatures[file.type];
  if (!verifySignature) return NextResponse.json({ error: "Formats acceptés : JPG, PNG ou WebP." }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!verifySignature(bytes)) return NextResponse.json({ error: "Le contenu du fichier ne correspond pas à une image valide." }, { status: 400 });
  const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
  const path = `${user.id}/profile.${extension}`;
  const supabase = getSupabaseAdminClient();
  const { data: previous } = await supabase.from("profiles").select("avatar_path").eq("id", user.id).maybeSingle();
  const { error: uploadError } = await supabase.storage.from("member-avatars").upload(path, bytes, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: true,
  });
  if (uploadError) {
    console.error("Could not upload member avatar:", uploadError.message);
    return NextResponse.json({ error: "Le téléversement de la photo a échoué." }, { status: 500 });
  }
  const { error: updateError } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", user.id);
  if (updateError) {
    await supabase.storage.from("member-avatars").remove([path]);
    console.error("Could not save member avatar path:", updateError.message);
    return NextResponse.json({ error: "Impossible d’enregistrer votre photo." }, { status: 500 });
  }
  if (previous?.avatar_path && previous.avatar_path !== path) {
    const { error } = await supabase.storage.from("member-avatars").remove([previous.avatar_path]);
    if (error) console.error("Could not remove replaced member avatar:", error.message);
  }
  return NextResponse.json({ uploaded: true }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Connectez-vous pour modifier votre photo." }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  const { data: profile, error: readError } = await supabase.from("profiles").select("avatar_path").eq("id", user.id).maybeSingle();
  if (readError) return NextResponse.json({ error: "Impossible de charger votre profil." }, { status: 500 });
  if (!profile?.avatar_path) return NextResponse.json({ removed: true });
  const { error: removeError } = await supabase.storage.from("member-avatars").remove([profile.avatar_path]);
  if (removeError) {
    console.error("Could not remove member avatar:", removeError.message);
    return NextResponse.json({ error: "Impossible de supprimer votre photo." }, { status: 500 });
  }
  const { error: updateError } = await supabase.from("profiles").update({ avatar_path: null }).eq("id", user.id);
  if (updateError) {
    console.error("Could not clear member avatar path:", updateError.message);
    return NextResponse.json({ error: "La photo a été supprimée, mais le profil n’a pas pu être actualisé." }, { status: 500 });
  }
  return NextResponse.json({ removed: true }, { headers: { "Cache-Control": "private, no-store" } });
}
