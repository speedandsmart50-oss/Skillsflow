import { NextResponse } from "next/server";
import { recordAdminAction, requireAdminApiUser } from "@/lib/security/admin-api";

function csvCell(value: string) {
  const safeValue = /^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const access = await requireAdminApiUser(request);
  if (!access.ok) return access.response;

  const { data, error } = await access.supabase
    .from("waitlist")
    .select("id, email, source, created_at")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) {
    console.error("Could not load waitlist:", error.message);
    return NextResponse.json({ error: "Impossible de charger la liste d’attente." }, { status: 500 });
  }

  if (new URL(request.url).searchParams.get("format") === "csv") {
    try {
      await recordAdminAction(access.supabase, access.user.id, "waitlist.export.csv", "waitlist", null, "requested", {
        entryCount: data?.length ?? 0,
      });
    } catch (caught) {
      return NextResponse.json({
        error: caught instanceof Error ? caught.message : "Impossible d’enregistrer l’export dans le journal d’audit.",
      }, { status: 500 });
    }

    const rows = [
      ["Adresse e-mail", "Origine", "Inscription le"].map(csvCell).join(","),
      ...(data ?? []).map((entry) => [
        csvCell(entry.email),
        csvCell(entry.source ?? ""),
        csvCell(entry.created_at),
      ].join(",")),
    ];
    try {
      await recordAdminAction(access.supabase, access.user.id, "waitlist.export.csv", "waitlist", null, "completed", {
        entryCount: data?.length ?? 0,
      });
    } catch (caught) {
      return NextResponse.json({
        error: caught instanceof Error ? caught.message : "Le journal d’audit n’a pas pu confirmer l’export.",
      }, { status: 500 });
    }

    return new Response(`\uFEFF${rows.join("\r\n")}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="liste-attente-skillflow.csv"',
        "Cache-Control": "private, no-store",
      },
    });
  }

  return NextResponse.json({ entries: data }, { headers: { "Cache-Control": "private, no-store" } });
}
