import { NextResponse } from "next/server";
import { getCommunitySession, isValidUuid } from "@/lib/community/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  if (!isValidUuid(userId)) return NextResponse.json({ error: "Profil introuvable." }, { status: 404 });
  const session = await getCommunitySession();
  if (!session) return NextResponse.json({ error: "Connectez-vous pour continuer." }, { status: 401 });
  if (userId === session.user.id) return NextResponse.json({ error: "Consultez votre profil depuis Mon compte." }, { status: 400 });
  const communityId = new URL(request.url).searchParams.get("community");
  if (!isValidUuid(communityId)) return NextResponse.json({ error: "Communauté invalide." }, { status: 400 });
  const [{ data: mine }, { data: peer }] = await Promise.all([
    session.supabase.from("member_community_memberships").select("community_id").eq("user_id", session.user.id).eq("community_id", communityId),
    session.supabase.from("member_community_memberships").select("community_id, display_name, member_role, joined_at, share_avatar").eq("user_id", userId).eq("community_id", communityId),
  ]);
  const mineIds = new Set((mine ?? []).map((row) => row.community_id));
  const shared = (peer ?? []).filter((row) => mineIds.has(row.community_id));
  if (!shared.length) return NextResponse.json({ error: "Ce profil est visible uniquement par les membres d’une même communauté." }, { status: 403 });
  const ids = [communityId];
  const { data: communities } = await session.supabase.from("member_communities").select("id, name").in("id", ids);
  const profile = shared[0];
  const admin = getSupabaseAdminClient();
  const { data: accountProfile } = await admin.from("profiles").select("avatar_path").eq("id", userId).maybeSingle();
  const mayShareAvatar = profile.share_avatar;
  const { data: avatar } = mayShareAvatar && accountProfile?.avatar_path
    ? await admin.storage.from("member-avatars").createSignedUrl(accountProfile.avatar_path, 300)
    : { data: null };
  return NextResponse.json({ profile: { userId, displayName: profile.display_name, avatarUrl: avatar?.signedUrl ?? null, memberSince: profile.joined_at, communities: (communities ?? []).map((community) => community.name) } }, { headers: { "Cache-Control": "private, no-store" } });
}
