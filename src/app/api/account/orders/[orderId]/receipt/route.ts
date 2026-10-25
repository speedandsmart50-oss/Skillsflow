import { NextResponse } from "next/server";
import { getAuthenticatedUser, getSupabaseAdminClient } from "@/lib/supabase/server";

function pdfText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/([\\()])/g, "\\$1");
}

function createReceiptPdf(lines: string[]) {
  const commands = ["BT", "/F1 20 Tf", "50 790 Td", `(${pdfText(lines[0])}) Tj`, "/F1 11 Tf"];
  for (const line of lines.slice(1)) commands.push("0 -30 Td", `(${pdfText(line)}) Tj`);
  commands.push("ET");
  const stream = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`,
  ];
  let document = "%PDF-1.4\n%SkillFlow\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(document, "ascii"));
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(document, "ascii");
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) document += `${String(offset).padStart(10, "0")} 00000 n \n`;
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(document, "ascii");
}

export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Connectez-vous pour télécharger ce reçu." }, { status: 401 });

  const { orderId } = await params;
  const { data: order, error } = await getSupabaseAdminClient()
    .from("orders")
    .select("id, order_reference, total, total_xof, currency, payment_status, created_at, paid_at, user_id, products(name)")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Could not load receipt order:", error.message);
    return NextResponse.json({ error: "Impossible de préparer ce reçu." }, { status: 500 });
  }
  if (!order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  if (order.payment_status !== "paid") {
    return NextResponse.json({ error: "Le reçu sera disponible après confirmation du paiement." }, { status: 409 });
  }

  const currency = order.currency === "EUR" ? "EUR" : "XOF";
  const amount = currency === "XOF"
    ? `${new Intl.NumberFormat("fr-FR").format(order.total_xof ?? order.total)} XOF`
    : `${Number(order.total).toFixed(2)} EUR`;
  const reference = order.order_reference || order.id;
  const pdf = createReceiptPdf([
    "Recu de paiement SkillFlow",
    `Reference : ${reference}`,
    `Date du paiement : ${new Date(order.paid_at ?? order.created_at).toLocaleDateString("fr-FR")}`,
    `Client : ${user.email ?? ""}`,
    `Produit : ${order.products?.name ?? "SkillFlow"}`,
    `Montant regle : ${amount}`,
    "Paiement traite par SasPay.",
    "Ce document confirme le paiement enregistre pour cette commande.",
  ]);
  const safeReference = reference.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="skillflow-recu-${safeReference}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
