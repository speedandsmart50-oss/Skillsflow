import { NextResponse } from "next/server";
import { recordAdminAction, requireAdminApiUser } from "@/lib/security/admin-api";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TICKET_STATUSES = new Set(["open", "in_progress", "resolved", "closed"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: Request) {
  const access = await requireAdminApiUser(request);
  if (!access.ok) return access.response;

  const status = new URL(request.url).searchParams.get("status");
  if (status && !TICKET_STATUSES.has(status)) {
    return NextResponse.json({ error: "Filtre de demandes invalide." }, { status: 400 });
  }

  let query = access.supabase
    .from("support_tickets")
    .select("id, user_id, order_id, category, subject, message, status, created_at, updated_at, resolved_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (status) query = query.eq("status", status);
  const { data: tickets, error } = await query;
  if (error) {
    console.error("Could not load support tickets for admin:", error.message);
    return NextResponse.json({ error: "Impossible de charger les demandes d’aide." }, { status: 500 });
  }

  const userIds = [...new Set((tickets ?? []).map((ticket) => ticket.user_id))];
  const { data: profiles, error: profileError } = userIds.length
    ? await access.supabase.from("profiles").select("id, email").in("id", userIds)
    : { data: [], error: null };
  if (profileError) {
    console.error("Could not load support ticket owners:", profileError.message);
    return NextResponse.json({ error: "Impossible de charger les clients concernés." }, { status: 500 });
  }
  const emailsById = new Map((profiles ?? []).map((profile) => [profile.id, profile.email]));
  return NextResponse.json({
    tickets: (tickets ?? []).map((ticket) => ({
      ...ticket,
      email: emailsById.get(ticket.user_id) ?? "Compte introuvable",
    })),
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
    || typeof body.ticketId !== "string"
    || !UUID_PATTERN.test(body.ticketId)
    || typeof body.status !== "string"
    || !TICKET_STATUSES.has(body.status)
    || (["resolved", "closed"].includes(body.status) && body.confirmation !== "CONFIRMER")
  ) {
    return NextResponse.json({ error: "Vérifiez le statut et confirmez la clôture si nécessaire." }, { status: 400 });
  }

  const { data: ticket, error: lookupError } = await access.supabase
    .from("support_tickets")
    .select("id, user_id, category, status")
    .eq("id", body.ticketId)
    .maybeSingle();
  if (lookupError) {
    console.error("Could not load support ticket for update:", lookupError.message);
    return NextResponse.json({ error: "Impossible de vérifier cette demande." }, { status: 500 });
  }
  if (!ticket) return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
  if (ticket.status === body.status) return NextResponse.json({ error: "Cette demande a déjà ce statut." }, { status: 409 });

  try {
    await recordAdminAction(access.supabase, access.user.id, "support_ticket.status.update", "support_ticket", ticket.id, "requested", {
      previousStatus: ticket.status,
      nextStatus: body.status,
      category: ticket.category,
      userId: ticket.user_id,
    });
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : "Impossible d’enregistrer cette action." }, { status: 500 });
  }

  const now = new Date().toISOString();
  const { data, error } = await access.supabase
    .from("support_tickets")
    .update({
      status: body.status,
      updated_at: now,
      resolved_at: ["resolved", "closed"].includes(body.status) ? now : null,
    })
    .eq("id", ticket.id)
    .select("id, status, updated_at, resolved_at")
    .single();
  if (error) {
    console.error("Could not update support ticket:", error.message);
    return NextResponse.json({ error: "Impossible de modifier cette demande." }, { status: 500 });
  }

  try {
    await recordAdminAction(access.supabase, access.user.id, "support_ticket.status.update", "support_ticket", ticket.id, "completed", {
      previousStatus: ticket.status,
      nextStatus: body.status,
      category: ticket.category,
      userId: ticket.user_id,
    });
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : "Le journal d’audit n’a pas pu confirmer l’action." }, { status: 500 });
  }
  return NextResponse.json({ ticket: data }, { headers: { "Cache-Control": "private, no-store" } });
}
