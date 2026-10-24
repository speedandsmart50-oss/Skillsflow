import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Le traitement des paiements n'est pas encore activé." },
    { status: 503 },
  );
}
