import { NextResponse } from "next/server";
import { getCommunitySession, isSameOriginRequest, isValidUuid } from "@/lib/community/server";

type Context = { params: Promise<{ communityId: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { communityId } = await params;
  if (!isValidUuid(communityId)) return NextResponse.json({ error: "Communauté introuvable." }, { status: 404 });
  const session = await getCommunitySession();
  if (!session) return NextResponse.json({ error: "Connectez-vous pour continuer." }, { status: 401 });
  const { data: membership } = await session.supabase.from("member_community_memberships").select("member_role, display_name, share_progress, share_avatar").eq("community_id", communityId).eq("user_id", session.user.id).maybeSingle();
  if (!membership) return NextResponse.json({ error: "Vous n’avez pas accès à cette communauté." }, { status: 403 });
  const [{ data: community }, { data: channels }, { data: members }, { data: tasks }] = await Promise.all([
    session.supabase.from("member_communities").select("id, name, description, weekly_objective, objective_week_start, created_at").eq("id", communityId).maybeSingle(),
    session.supabase.from("member_community_channels").select("id, name, description").eq("community_id", communityId).order("created_at"),
    session.supabase.from("member_community_memberships").select("user_id, display_name, member_role, joined_at, share_progress, share_avatar").eq("community_id", communityId).order("joined_at"),
    session.supabase.from("member_community_tasks").select("id, title, due_at, assigned_to, created_by, created_at").eq("community_id", communityId).order("due_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }),
  ]);
  if (!community) return NextResponse.json({ error: "Communauté introuvable." }, { status: 404 });
  const currentWeek = new Date();
  currentWeek.setUTCDate(currentWeek.getUTCDate() - ((currentWeek.getUTCDay() + 6) % 7));
  const currentWeekStart = currentWeek.toISOString().slice(0, 10);
  const currentCommunity = community.objective_week_start === currentWeekStart
    ? community
    : { ...community, weekly_objective: "", objective_week_start: null };
  const channel = channels?.[0];
  const { data: messages } = channel ? await session.supabase.from("member_community_messages").select("id, author_id, author_name, content, created_at").eq("channel_id", channel.id).order("created_at", { ascending: false }).limit(60) : { data: [] };
  const taskIds = (tasks ?? []).map((task) => task.id);
  const { data: checks } = taskIds.length ? await session.supabase.from("member_community_task_checks").select("task_id, user_id").in("task_id", taskIds) : { data: [] };
  let inviteUrl: string | null = null;
  if (membership.member_role === "owner" || membership.member_role === "manager") {
    const { data: inviteToken } = await session.supabase.rpc("get_member_community_invite_token", { p_community_id: communityId });
    if (inviteToken) inviteUrl = `/community/my?invite=${inviteToken}`;
  }
  return NextResponse.json({ community: currentCommunity, membership, channels: channels ?? [], channel, members: members ?? [], messages: (messages ?? []).reverse(), tasks: tasks ?? [], checks: checks ?? [], inviteUrl }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request, { params }: Context) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Requête non autorisée." }, { status: 403 });
  const { communityId } = await params;
  if (!isValidUuid(communityId)) return NextResponse.json({ error: "Communauté introuvable." }, { status: 404 });
  const session = await getCommunitySession();
  if (!session) return NextResponse.json({ error: "Connectez-vous pour continuer." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Données invalides." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  const input = body as { action?: unknown; content?: unknown; title?: unknown; dueAt?: unknown; assignedTo?: unknown; taskId?: unknown; completed?: unknown; objective?: unknown };
  const { data: member } = await session.supabase.from("member_community_memberships").select("display_name, member_role").eq("community_id", communityId).eq("user_id", session.user.id).maybeSingle();
  if (!member) return NextResponse.json({ error: "Vous n’avez pas accès à cette communauté." }, { status: 403 });
  if (input.action === "objective") {
    if (member.member_role === "member") return NextResponse.json({ error: "Seuls les responsables peuvent définir l’objectif de la semaine." }, { status: 403 });
    if (typeof input.objective !== "string" || input.objective.trim().length < 5 || input.objective.trim().length > 240) return NextResponse.json({ error: "L’objectif doit contenir entre 5 et 240 caractères." }, { status: 400 });
    const today = new Date();
    today.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
    const { error } = await session.supabase.from("member_communities").update({ weekly_objective: input.objective.trim(), objective_week_start: today.toISOString().slice(0, 10) }).eq("id", communityId);
    return error ? NextResponse.json({ error: "Impossible d’enregistrer l’objectif." }, { status: 503 }) : NextResponse.json({ saved: true });
  }
  if (input.action === "privacy") {
    const value = input as typeof input & { shareProgress?: unknown; shareAvatar?: unknown };
    if (typeof value.shareProgress !== "boolean" || typeof value.shareAvatar !== "boolean") return NextResponse.json({ error: "Choisissez des options de partage valides." }, { status: 400 });
    const { error } = await session.supabase.from("member_community_memberships").update({ share_progress: value.shareProgress, share_avatar: value.shareAvatar }).eq("community_id", communityId).eq("user_id", session.user.id);
    return error ? NextResponse.json({ error: "Impossible d’enregistrer vos préférences." }, { status: 503 }) : NextResponse.json({ saved: true });
  }
  if (input.action === "message") {
    if (typeof input.content !== "string" || input.content.trim().length < 1 || input.content.trim().length > 4000) return NextResponse.json({ error: "Le message doit contenir entre 1 et 4 000 caractères." }, { status: 400 });
    const { data: channel } = await session.supabase.from("member_community_channels").select("id").eq("community_id", communityId).order("created_at").limit(1).maybeSingle();
    if (!channel) return NextResponse.json({ error: "Aucun canal de discussion n’est disponible." }, { status: 409 });
    const { error } = await session.supabase.from("member_community_messages").insert({ community_id: communityId, channel_id: channel.id, author_id: session.user.id, author_name: member.display_name, content: input.content.trim() });
    return error ? NextResponse.json({ error: "Impossible d’envoyer le message." }, { status: 503 }) : NextResponse.json({ sent: true }, { status: 201 });
  }
  if (input.action === "task") {
    if (member.member_role === "member") return NextResponse.json({ error: "Seuls les responsables peuvent ajouter des actions." }, { status: 403 });
    if (typeof input.title !== "string" || input.title.trim().length < 2 || input.title.trim().length > 180 || (input.dueAt !== null && input.dueAt !== undefined && (typeof input.dueAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.dueAt))) || (input.assignedTo !== null && input.assignedTo !== undefined && !isValidUuid(input.assignedTo))) return NextResponse.json({ error: "Vérifiez l’intitulé, le responsable et l’échéance." }, { status: 400 });
    const { error } = await session.supabase.from("member_community_tasks").insert({ community_id: communityId, created_by: session.user.id, title: input.title.trim(), due_at: input.dueAt || null, assigned_to: input.assignedTo || null });
    return error ? NextResponse.json({ error: "Impossible d’ajouter cette action." }, { status: 503 }) : NextResponse.json({ saved: true }, { status: 201 });
  }
  if (input.action === "check") {
    if (!isValidUuid(input.taskId) || typeof input.completed !== "boolean") return NextResponse.json({ error: "Action invalide." }, { status: 400 });
    const query = session.supabase.from("member_community_task_checks");
    const result = input.completed ? await query.insert({ task_id: input.taskId, user_id: session.user.id }) : await query.delete().eq("task_id", input.taskId).eq("user_id", session.user.id);
    return result.error && result.error.code !== "23505" ? NextResponse.json({ error: "Impossible d’enregistrer votre progression." }, { status: 503 }) : NextResponse.json({ saved: true });
  }
  return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
}
