import { NextResponse } from "next/server";
import { getAuthenticatedUser, getSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Connectez-vous pour télécharger votre pack." }, { status: 401 });
  }

  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId");
  const productSlug = url.searchParams.get("slug");
  if (
    (!orderId && !productSlug)
    || (orderId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId))
  ) {
    return NextResponse.json({ error: "Commande invalide." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    console.error("Could not verify download role:", profileError.message);
    return NextResponse.json({ error: "Impossible de vérifier vos droits." }, { status: 500 });
  }

  let productId: string;
  if (profile?.role === "admin" && productSlug) {
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id")
      .eq("slug", productSlug)
      .maybeSingle();
    if (productError) {
      console.error("Could not find admin product:", productError.message);
      return NextResponse.json({ error: "Impossible de charger le pack." }, { status: 500 });
    }
    if (!product) return NextResponse.json({ error: "Pack introuvable." }, { status: 404 });
    productId = product.id;
  } else {
    if (!orderId) {
      return NextResponse.json({ error: "Achat ou accès administrateur requis." }, { status: 403 });
    }
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, product_id")
      .eq("id", orderId)
      .eq("user_id", user.id)
      .eq("payment_status", "paid")
      .maybeSingle();

    if (orderError) {
      console.error("Could not verify download purchase:", orderError.message);
      return NextResponse.json({ error: "Impossible de vérifier votre achat." }, { status: 500 });
    }
    if (!order) {
      return NextResponse.json({ error: "Aucun achat payé ne donne accès à ce téléchargement." }, { status: 403 });
    }
    productId = order.product_id;
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, name, slug, version, zip_path, status")
    .eq("id", productId)
    .maybeSingle();

  if (productError) {
    console.error("Could not load purchased product:", productError.message);
    return NextResponse.json({ error: "Impossible de charger le pack acheté." }, { status: 500 });
  }
  if (!product || product.status !== "published" || !product.zip_path) {
    return NextResponse.json({ error: "Le pack n'est pas disponible au téléchargement." }, { status: 404 });
  }

  const { data: signedUrl, error: signedUrlError } = await supabase.storage
    .from("product-packs")
    .createSignedUrl(product.zip_path, 300, { download: `${product.slug}-v${product.version}.zip` });

  if (signedUrlError || !signedUrl?.signedUrl) {
    console.error("Could not create product download URL:", signedUrlError?.message ?? "no signed URL returned");
    return NextResponse.json({ error: "Le téléchargement est temporairement indisponible." }, { status: 503 });
  }

  const { error: downloadError } = await supabase.from("downloads").insert({
    user_id: user.id,
    product_id: product.id,
    version: product.version,
  });
  if (downloadError) {
    console.error("Could not record product download:", downloadError.message);
    return NextResponse.json({ error: "Impossible d'enregistrer le téléchargement." }, { status: 500 });
  }

  return NextResponse.json({ downloadUrl: signedUrl.signedUrl });
}
