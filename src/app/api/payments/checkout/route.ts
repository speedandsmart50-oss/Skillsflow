import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Les paiements ne sont pas encore ouverts." },
    { status: 503 },
  );
}
