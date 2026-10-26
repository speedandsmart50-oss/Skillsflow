import { NextResponse } from "next/server";
import { getCommunitySession, isSameOriginRequest, isValidUuid } from "@/lib/community/server";

async function getAccess() {
  const context = await getCommunitySession();
  if (!context) return { response: NextResponse.json({ error: "Connectez-vous pour accéder au suivi." }, { status: 401 }) };

  const [{ data: profile }, { data: activeRules }, { data: channel }, { data: staffRole }] = await Promise.all([
    context.supabase.from("profiles").select("community_rules_version, role").eq("id", context.user.id).maybeSingle(),
    context.supabase.from("community_rules").select("version").eq("is_active", true).maybeSingle(),
    context.supabase.from("channels").select("id").eq("slug", "organisation").eq("is_active", true).maybeSingle(),
    context.supabase.from("community_staff").select("staff_role").eq("user_id", context.user.id).maybeSingle(),
  ]);
  if (!profile || !activeRules || profile.community_rules_version !== activeRules.version) {
    return { response: NextResponse.json({ error: "Acceptez les règles de la communauté pour accéder au suivi." }, { status: 428 }) };
  }
  if (!channel) return { response: NextResponse.json({ error: "Le salon Organisation est inaccessible." }, { status: 403 }) };
  return { context, channelId: channel.id, isStaff: profile.role === "admin" || Boolean(staffRole) };
}

function weekStartUtc() {
  const now = new Date();
  const day = now.getUTCDay() || 7;
  now.setUTCDate(now.getUTCDate() - day + 1);
  return now.toISOString().slice(0, 10);
}

export async function GET() {
  const access = await getAccess();
  if ("response" in access) return access.response;
  const { context, isStaff } = access;
  const { data: goal, error: goalError } = await context.supabase
    .from("community_weekly_goals")
    .select("id, title, description, week_start")
    .eq("week_start", weekStartUtc())
    .maybeSingle();
  if (goalError) {
    console.error("Could not load community weekly goal:", goalError.message);
    return NextResponse.json({ error: "Impossible de charger l’objectif de la semaine." }, { status: 503 });
  }
  if (!goal) return NextResponse.json({ goal: null, tasks: [], myCompletedTaskIds: [], members: [], isStaff }, { headers: { "Cache-Control": "private, no-store" } });

  const [{ data: tasks, error: tasksError }, { data: roster, error: rosterError }] = await Promise.all([
    context.supabase.from("community_weekly_goal_tasks").select("id, label, position").eq("goal_id", goal.id).order("position"),
    context.supabase.rpc("community_weekly_goal_roster"),
  ]);
  if (tasksError || rosterError) {
    console.error("Could not load community weekly checklist:", tasksError?.message ?? rosterError?.message);
    return NextResponse.json({ error: "Impossible de charger la checklist de la semaine." }, { status: 503 });
  }
  const taskRows = (tasks ?? []) as Array<{ id: string; label: string; position: number }>;
  const taskIds = taskRows.map((task) => task.id);
  const { data: checks, error: checksError } = taskIds.length
    ? await context.supabase.from("community_weekly_goal_checks").select("task_id, user_id").in("task_id", taskIds)
    : { data: [], error: null };
  if (checksError) {
    console.error("Could not load community weekly progress:", checksError.message);
    return NextResponse.json({ error: "Impossible de charger la progression des membres." }, { status: 503 });
  }

  const checkRows = (checks ?? []) as Array<{ task_id: string; user_id: string }>;
  const memberRows = (roster ?? []) as Array<{ user_id: string; display_name: string }>;
  const memberTotal = taskRows.length;
  const members = memberRows.map((member) => {
    const completedCount = checkRows.filter((check) => check.user_id === member.user_id).length;
    return {
      name: member.display_name,
      completedCount,
      totalCount: memberTotal,
      percentage: memberTotal ? Math.round((completedCount / memberTotal) * 100) : 0,
      isCurrentUser: member.user_id === context.user.id,
    };
  });
  return NextResponse.json({
    goal,
    tasks: taskRows,
    myCompletedTaskIds: checkRows.filter((check) => check.user_id === context.user.id).map((check) => check.task_id),
    members,
    isStaff,
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Requête non autorisée." }, { status: 403 });
  const access = await getAccess();
  if ("response" in access) return access.response;
  if (!access.isStaff) return NextResponse.json({ error: "Cette action est réservée au staff." }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Données invalides." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  const { title, description, tasks } = body as { title?: unknown; description?: unknown; tasks?: unknown };
  if (typeof title !== "string" || title.trim().length < 3 || title.trim().length > 140
    || typeof description !== "string" || description.trim().length > 500
    || !Array.isArray(tasks) || tasks.length < 1 || tasks.length > 12
    || tasks.some((task) => typeof task !== "string" || task.trim().length < 2 || task.trim().length > 140)) {
    return NextResponse.json({ error: "Ajoutez un titre, une description de 500 caractères maximum et de 1 à 12 actions." }, { status: 400 });
  }
  const { data, error } = await access.context.supabase.rpc("set_community_weekly_goal", {
    p_title: title.trim(),
    p_description: description.trim(),
    p_tasks: tasks.map((task: string) => task.trim()),
  });
  if (error) {
    console.error("Could not save community weekly goal:", error.message);
    return NextResponse.json({ error: "Impossible d’enregistrer l’objectif de la semaine." }, { status: 503 });
  }
  return NextResponse.json({ goalId: data }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Requête non autorisée." }, { status: 403 });
  const access = await getAccess();
  if ("response" in access) return access.response;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Données invalides." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  const { taskId, completed } = body as { taskId?: unknown; completed?: unknown };
  if (!isValidUuid(taskId) || typeof completed !== "boolean") return NextResponse.json({ error: "Action invalide." }, { status: 400 });

  if (completed) {
    const { error } = await access.context.supabase.from("community_weekly_goal_checks")
      .insert({ task_id: taskId, user_id: access.context.user.id });
    if (error && error.code !== "23505") {
      console.error("Could not mark community weekly task:", error.message);
      return NextResponse.json({ error: "Impossible d’enregistrer cette action." }, { status: 503 });
    }
  } else {
    const { error } = await access.context.supabase.from("community_weekly_goal_checks")
      .delete().eq("task_id", taskId).eq("user_id", access.context.user.id);
    if (error) {
      console.error("Could not unmark community weekly task:", error.message);
      return NextResponse.json({ error: "Impossible de mettre à jour cette action." }, { status: 503 });
    }
  }
  return NextResponse.json({ updated: true });
}
