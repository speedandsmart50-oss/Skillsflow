import { NextResponse } from "next/server";
import { getAuthenticatedUser, getSupabaseAdminClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SKILL_FORMATS = new Set(["claude", "chatgpt", "archive"]);

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Connectez-vous pour télécharger votre pack." }, { status: 401 });
  }

  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId");
  const productSlug = url.searchParams.get("slug");
  const requestedProductId = url.searchParams.get("productId");
  const requestedVersion = url.searchParams.get("version");
  const format = url.searchParams.get("format");
  const skillDownload = Boolean(requestedProductId || requestedVersion || format);
  const supabase = getSupabaseAdminClient();

  if (skillDownload) {
    if (
      !requestedProductId
      || !UUID_PATTERN.test(requestedProductId)
      || !format
      || !SKILL_FORMATS.has(format)
      || !requestedVersion
      || requestedVersion.length > 40
      || orderId
      || productSlug
    ) {
      return NextResponse.json({ error: "Paramètres de téléchargement invalides." }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) {
      console.error("Could not verify skill download role:", profileError.message);
      return NextResponse.json({ error: "Impossible de vérifier vos droits." }, { status: 500 });
    }

    if (profile?.role !== "admin") {
      const { data: entitlement, error: entitlementError } = await supabase
        .from("entitlements")
        .select("id")
        .eq("user_id", user.id)
        .eq("product_id", requestedProductId)
        .eq("status", "active")
        .maybeSingle();
      if (entitlementError) {
        console.error("Could not verify skill entitlement:", entitlementError.message);
        return NextResponse.json({ error: "Impossible de vérifier votre accès." }, { status: 500 });
      }
      if (!entitlement) {
        return NextResponse.json({ error: "Aucun accès actif ne permet ce téléchargement." }, { status: 403 });
      }
    }

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, slug, version, zip_path")
      .eq("id", requestedProductId)
      .maybeSingle();
    if (productError) {
      console.error("Could not load entitled skill:", productError.message);
      return NextResponse.json({ error: "Impossible de charger le skill." }, { status: 500 });
    }
    if (!product) return NextResponse.json({ error: "Ce skill est introuvable." }, { status: 404 });

    const { data: version, error: versionError } = await supabase
      .from("skill_versions")
      .select("claude_file_path, chatgpt_file_path, archive_path")
      .eq("product_id", product.id)
      .eq("version", requestedVersion)
      .eq("status", "published")
      .maybeSingle();
    if (versionError) {
      console.error("Could not load requested skill version:", versionError.message);
      return NextResponse.json({ error: "Impossible de charger cette version." }, { status: 500 });
    }

    const storagePath = format === "claude"
      ? version?.claude_file_path
      : format === "chatgpt"
        ? version?.chatgpt_file_path
        : version?.archive_path ?? product.zip_path;
    if (!version || !storagePath) {
      return NextResponse.json({ error: "Ce format n’est pas encore disponible." }, { status: 404 });
    }

    const fileName = storagePath.split("/").pop() ?? "";
    const extension = fileName.includes(".") ? fileName.split(".").pop() : "";
    const downloadName = format === "archive"
      ? `${product.slug}-v${requestedVersion}.zip`
      : `${product.slug}-v${requestedVersion}-${format}${extension ? `.${extension}` : ""}`;
    const { data: signedUrl, error: signedUrlError } = await supabase.storage
      .from("product-packs")
      .createSignedUrl(storagePath, 300, { download: downloadName });

    if (signedUrlError || !signedUrl?.signedUrl) {
      console.error("Could not create skill download URL:", signedUrlError?.message ?? "no signed URL returned");
      return NextResponse.json({ error: "Le téléchargement est temporairement indisponible." }, { status: 503 });
    }

    const { error: downloadError } = await supabase.from("downloads").insert({
      user_id: user.id,
      product_id: product.id,
      version: requestedVersion,
    });
    if (downloadError) {
      console.error("Could not record skill download:", downloadError.message);
      return NextResponse.json({ error: "Impossible d'enregistrer le téléchargement." }, { status: 500 });
    }

    return NextResponse.json({ downloadUrl: signedUrl.signedUrl }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  if (
    Boolean(orderId) === Boolean(productSlug)
    || (orderId && !UUID_PATTERN.test(orderId))
  ) {
    return NextResponse.json({ error: "Commande ou skill invalide." }, { status: 400 });
  }

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

    const { data: entitlement, error: entitlementError } = await supabase
      .from("entitlements")
      .select("id")
      .eq("user_id", user.id)
      .eq("product_id", order.product_id)
      .eq("status", "active")
      .maybeSingle();
    if (entitlementError) {
      console.error("Could not verify legacy download entitlement:", entitlementError.message);
      return NextResponse.json({ error: "Impossible de vérifier votre accès." }, { status: 500 });
    }
    if (!entitlement) {
      return NextResponse.json({ error: "L’accès à ce pack n’est plus actif." }, { status: 403 });
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

  return NextResponse.json({ downloadUrl: signedUrl.signedUrl }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
