import { NextResponse } from "next/server";
import { products } from "@/features/products/products";

export async function GET() {
  return NextResponse.json({ items: products });
}
