import { NextResponse } from "next/server";
import { connection } from "next/server";
import { getCatalogProducts } from "@/features/products/catalog";

export async function GET() {
  await connection();
  try {
    const items = await getCatalogProducts();
    return NextResponse.json({ items }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch {
    return NextResponse.json(
      { error: "Le catalogue est temporairement indisponible." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
