import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CheckoutForm } from "@/components/checkout-form";
import { getCatalogProductBySlug } from "@/features/products/catalog";
import { PRODUCT_SLUG } from "@/lib/pricing";

export default function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#0d1321]" aria-busy="true" />}>
      <CheckoutContent searchParams={searchParams} />
    </Suspense>
  );
}

async function CheckoutContent({
  searchParams,
}: {
  searchParams: Promise<{ product?: string | string[] }>;
}) {
  await connection();
  const params = await searchParams;
  const productSlug = typeof params.product === "string" ? params.product : PRODUCT_SLUG;
  const product = await getCatalogProductBySlug(productSlug);

  if (!product || product.catalogStatus !== "disponible" || !product.zipFile) {
    notFound();
  }

  return <CheckoutForm product={product} salesEnabled={process.env.SKILLFLOW_COMMERCE_ENABLED === "true"} />;
}
