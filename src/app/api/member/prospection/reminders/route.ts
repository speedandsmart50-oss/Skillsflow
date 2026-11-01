import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { getAuthenticatedUser, getSupabaseAdminClient } from "@/lib/supabase/server";
import { isConfiguredAdmin } from "@/lib/security/admin-access";

type PaidAccess =
  | { userId: string; supabase: ReturnType<typeof getSupabaseAdminClient> }
  | { response: NextResponse };

async function requirePaidUser(request: Request): Promise<PaidAccess> {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return {
      response: NextResponse.json(
        { error: "Connectez-vous pour utiliser Prospection." },
        { status: 401 },
      ),
    };
  }

  const supabase = getSupabaseAdminClient();
  if (!isConfiguredAdmin(user)) {
    const { data: hasSubscription, error } = await supabase.rpc(
      "has_active_member_subscription",
      { p_user_id: user.id },
    );
    if (error) {
      console.error("Could not verify prospection reminder subscription", {
        code: error.code,
      });
      return {
        response: NextResponse.json(
          { error: "Impossible de vérifier votre abonnement." },
          { status: 503 },
        ),
      };
    }
    if (!hasSubscription) {
      return {
        response: NextResponse.json(
          { error: "Un abonnement actif est requis pour utiliser Prospection." },
          { status: 403 },
        ),
      };
    }
  }

  return { userId: user.id, supabase };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: Request) {
  const access = await requirePaidUser(request);
  if ("response" in access) return access.response;

  const [prospectsResult, remindersResult] = await Promise.all([
    access.supabase
      .from("prospection_prospects")
      .select("id,name,stage")
      .eq("user_id", access.userId)
      .order("name"),
    access.supabase
      .from("prospection_reminders")
      .select("id,prospect_id,title,details,due_at,status,completed_at,created_at")
      .eq("user_id", access.userId)
      .order("due_at", { ascending: true })
      .limit(50),
  ]);
  const nowIso = new Date().toISOString();
  const [draftCount, overdueCount, completedCount] = await Promise.all([
    access.supabase
      .from("prospection_reminders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", access.userId)
      .eq("status", "draft"),
    access.supabase
      .from("prospection_reminders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", access.userId)
      .eq("status", "draft")
      .lt("due_at", nowIso),
    access.supabase
      .from("prospection_reminders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", access.userId)
      .eq("status", "completed"),
  ]);
  if (
    prospectsResult.error
    || remindersResult.error
    || draftCount.error
    || overdueCount.error
    || completedCount.error
  ) {
    console.error("Could not load prospection reminders", {
      prospectsCode: prospectsResult.error?.code,
      remindersCode: remindersResult.error?.code,
      draftCountCode: draftCount.error?.code,
      overdueCountCode: overdueCount.error?.code,
      completedCountCode: completedCount.error?.code,
    });
    return NextResponse.json(
      { error: "Impossible de charger vos rappels et indicateurs." },
      { status: 503 },
    );
  }

  const prospects = prospectsResult.data ?? [];
  const reminders = remindersResult.data ?? [];
  return NextResponse.json(
    {
      prospects,
      reminders,
      metrics: {
        prospects_total: prospects.length,
        prospects_active: prospects.filter(
          (prospect) => prospect.stage !== "won" && prospect.stage !== "lost",
        ).length,
        prospects_follow_up: prospects.filter(
          (prospect) => prospect.stage === "follow-up",
        ).length,
        prospects_won: prospects.filter((prospect) => prospect.stage === "won").length,
        reminders_draft: draftCount.count ?? 0,
        reminders_overdue: overdueCount.count ?? 0,
        reminders_completed: completedCount.count ?? 0,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const access = await requirePaidUser(request);
  if ("response" in access) return access.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }
  if (!isObject(body)) {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }

  const { prospect_id, title, details, due_at } = body;
  if (
    typeof prospect_id !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(prospect_id)
    || typeof title !== "string"
    || title.trim().length < 1
    || title.trim().length > 140
    || (details !== undefined && (typeof details !== "string" || details.length > 1000))
    || typeof due_at !== "string"
    || !Number.isFinite(Date.parse(due_at))
  ) {
    return NextResponse.json(
      { error: "Vérifiez le contact, le titre, le détail et la date du rappel." },
      { status: 400 },
    );
  }

  const dueDate = new Date(due_at);
  if (dueDate.getTime() < Date.now() || dueDate.getTime() > Date.now() + 365 * 24 * 60 * 60 * 1000) {
    return NextResponse.json(
      { error: "La date du rappel doit être comprise entre maintenant et un an." },
      { status: 400 },
    );
  }

  const { data: prospect, error: prospectError } = await access.supabase
    .from("prospection_prospects")
    .select("id")
    .eq("id", prospect_id)
    .eq("user_id", access.userId)
    .maybeSingle();
  if (prospectError) {
    console.error("Could not verify reminder prospect ownership", {
      code: prospectError.code,
    });
    return NextResponse.json(
      { error: "Impossible de vérifier ce contact." },
      { status: 503 },
    );
  }
  if (!prospect) {
    return NextResponse.json({ error: "Contact introuvable." }, { status: 404 });
  }

  const { data, error } = await access.supabase
    .from("prospection_reminders")
    .insert({
      user_id: access.userId,
      prospect_id,
      title: title.trim(),
      details: typeof details === "string" ? details.trim() : "",
      due_at: dueDate.toISOString(),
      idempotency_key: randomUUID(),
    })
    .select("id,prospect_id,title,details,due_at,status,completed_at,created_at")
    .single();
  if (error) {
    console.error("Could not create prospection reminder", { code: error.code });
    return NextResponse.json(
      { error: "Impossible de créer ce rappel." },
      { status: 503 },
    );
  }
  return NextResponse.json({ reminder: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const access = await requirePaidUser(request);
  if ("response" in access) return access.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }
  if (
    !isObject(body)
    || typeof body.id !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id)
    || (body.action !== "complete" && body.action !== "cancel")
  ) {
    return NextResponse.json({ error: "Action de rappel invalide." }, { status: 400 });
  }

  const completed = body.action === "complete";
  const { data, error } = await access.supabase
    .from("prospection_reminders")
    .update({
      status: completed ? "completed" : "cancelled",
      completed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.id)
    .eq("user_id", access.userId)
    .eq("status", "draft")
    .select("id,status,completed_at")
    .maybeSingle();
  if (error) {
    console.error("Could not update prospection reminder", { code: error.code });
    return NextResponse.json(
      { error: "Impossible de mettre à jour ce rappel." },
      { status: 503 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "Rappel introuvable ou déjà traité." },
      { status: 404 },
    );
  }
  return NextResponse.json({ reminder: data });
}
