import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CheckoutResult } from "@/components/checkout-result";

export default function CheckoutCompletePage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  return <Suspense fallback={<main className="min-h-[70vh] bg-[#0d1321]" aria-busy="true" />}><CompleteContent searchParams={searchParams} /></Suspense>;
}

async function CompleteContent({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  await connection();
  const { order } = await searchParams;
  if (!order || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(order)) notFound();

  return <CheckoutResult orderId={order} />;
}
