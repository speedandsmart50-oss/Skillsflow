import { NextResponse } from "next/server";
import { getAuthenticatedUser, getSupabaseAdminClient } from "@/lib/supabase/server";

type TicketCategory = "question" | "refund" | "other";

function isTicketCategory(value: unknown): value is TicketCategory {
  return value === "question" || value === "refund" || value === "other";
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Connectez-vous pour écrire à l’assistance." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Le formulaire est incomplet." }, { status: 400 });
  }
  if (
    typeof body !== "object"
    || body === null
    || !("category" in body)
    || !isTicketCategory(body.category)
    || !("subject" in body)
    || typeof body.subject !== "string"
    || body.subject.trim().length < 3
    || body.subject.trim().length > 160
    || !("message" in body)
    || typeof body.message !== "string"
    || body.message.trim().length < 10
    || body.message.trim().length > 5000
  ) {
    return NextResponse.json({ error: "Vérifiez l’objet et le message de votre demande." }, { status: 400 });
  }

  const orderId = "orderId" in body && typeof body.orderId === "string" ? body.orderId : null;
  const supabase = getSupabaseAdminClient();
  if (orderId) {
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id")
      .eq("id", orderId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (orderError) {
      console.error("Could not verify support ticket order:", orderError.message);
      return NextResponse.json({ error: "Impossible de vérifier la commande sélectionnée." }, { status: 500 });
    }
    if (!order) {
      return NextResponse.json({ error: "Cette commande n’appartient pas à votre compte." }, { status: 403 });
    }
  }

  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .insert({
      user_id: user.id,
      order_id: orderId,
      category: body.category,
      subject: body.subject.trim(),
      message: body.message.trim(),
    })
    .select("id, category, subject, status, created_at")
    .single();

  if (error) {
    console.error("Could not create support ticket:", error.message);
    return NextResponse.json({ error: "Impossible d’envoyer votre demande pour le moment." }, { status: 500 });
  }

  return NextResponse.json({ ticket }, {
    status: 201,
    headers: { "Cache-Control": "private, no-store" },
  });
}
