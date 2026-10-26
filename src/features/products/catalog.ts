import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getProductBySlug } from "@/features/products/products";
import type { CatalogStatus, Product, VersionEntry } from "@/types/skillflow";

type CatalogRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  domain?: string;
  status: "draft" | "published";
  catalog_status?: CatalogStatus;
  price_eur?: number | string | null;
  price_xof?: number | string | null;
  version: string | null;
  zip_path: string | null;
  is_member_skill?: boolean;
};

type VersionRow = {
  product_id: string;
  version: string;
  release_notes: string | null;
  status: "draft" | "published";
  published_at: string | null;
  created_at: string;
};

type BundleItemRow = { bundle_product_id: string; item_product_id: string };

function isSchemaCompatibilityError(error: { code?: string; message?: string } | null) {
  return Boolean(error && (
    error.code === "PGRST204"
    || error.code === "PGRST205"
    || error.code === "42P01"
    || error.code === "42703"
    || /schema cache|does not exist/i.test(error.message ?? "")
  ));
}

export async function getCatalogProducts(): Promise<Product[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase doit être configuré pour afficher le catalogue.");
  }

  const supabase = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  let { data: productData, error: productError } = await supabase
    .from("products")
    .select("id, slug, name, description, domain, status, catalog_status, price_eur, price_xof, version, zip_path")
    .eq("status", "published")
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  if (productError && isSchemaCompatibilityError(productError)) {
    // The legacy table has the fields introduced by migration 001. This keeps published skills visible
    // while a project that predates the catalog migration is being brought up to date.
    const legacyResult = await supabase
      .from("products")
      .select("id, slug, name, description, status, price, version, zip_path")
      .eq("status", "published")
      .order("created_at", { ascending: true });
    productData = (legacyResult.data ?? []).map((row) => ({
      ...row,
      domain: undefined,
      catalog_status: "disponible" as const,
      price_eur: row.price,
      price_xof: Math.round(Number(row.price) * 655.957),
      archived_at: null,
    }));
    productError = legacyResult.error;
  }

  if (productError) {
    console.error("Could not load public catalogue:", productError.message);
    throw new Error("Le catalogue est temporairement indisponible.");
  }

  const rows = (productData ?? []) as CatalogRow[];
  const productIds = rows.map((product) => product.id);
  const linkedSkillsResult = productIds.length
    ? await supabase.from("skills").select("product_id").in("product_id", productIds).eq("is_active", true)
    : { data: [], error: null };
  if (linkedSkillsResult.error && !isSchemaCompatibilityError(linkedSkillsResult.error)) {
    console.error("Could not load catalog skill links:", linkedSkillsResult.error.message);
  }
  const memberSkillProductIds = new Set((linkedSkillsResult.data ?? []).map((skill) => skill.product_id));
  const bundleItemsResult = productIds.length
    ? await supabase.from("product_bundle_items").select("bundle_product_id, item_product_id").in("bundle_product_id", productIds).order("position", { ascending: true })
    : { data: [], error: null };
  if (bundleItemsResult.error && !isSchemaCompatibilityError(bundleItemsResult.error)) {
    console.error("Could not load catalog bundle items:", bundleItemsResult.error.message);
    throw new Error("Les packs du catalogue sont temporairement indisponibles.");
  }
  const bundleItems = (bundleItemsResult.data ?? []) as BundleItemRow[];
  const bundleItemProductIds = [...new Set(bundleItems.map((item) => item.item_product_id))];
  const bundleProductsResult = bundleItemProductIds.length
    ? await supabase.from("products").select("id, name").in("id", bundleItemProductIds).eq("status", "published").is("archived_at", null)
    : { data: [], error: null };
  if (bundleProductsResult.error && !isSchemaCompatibilityError(bundleProductsResult.error)) {
    console.error("Could not load catalog bundle product names:", bundleProductsResult.error.message);
    throw new Error("Les packs du catalogue sont temporairement indisponibles.");
  }
  const bundleItemNames = new Map((bundleProductsResult.data ?? []).map((item) => [item.id, item.name]));
  const bundleNamesByProductId = new Map<string, string[]>();
  for (const item of bundleItems) {
    const itemName = bundleItemNames.get(item.item_product_id);
    if (!itemName) continue;
    const current = bundleNamesByProductId.get(item.bundle_product_id) ?? [];
    current.push(itemName);
    bundleNamesByProductId.set(item.bundle_product_id, current);
  }
  let versions: VersionRow[] = [];

  if (productIds.length) {
    let { data, error } = await supabase
      .from("skill_versions")
      .select("product_id, version, release_notes, status, published_at, created_at")
      .in("product_id", productIds)
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (error && isSchemaCompatibilityError(error)) {
      const legacyVersions = await supabase
        .from("product_versions")
        .select("product_id, version, release_notes, status, published_at")
        .in("product_id", productIds)
        .eq("status", "published")
        .order("published_at", { ascending: false });
      data = (legacyVersions.data ?? []).map((version) => ({ ...version, created_at: version.published_at ?? "" }));
      error = legacyVersions.error;
    }

    if (error) {
      console.error("Could not load published catalogue versions:", error.message);
      throw new Error("Les versions du catalogue sont temporairement indisponibles.");
    }
    versions = (data ?? []) as VersionRow[];
  }

  const products = rows.map((row) => {
    const existingProduct = getProductBySlug(row.slug);
    const publishedVersions: VersionEntry[] = versions
      .filter((version) => version.product_id === row.id)
      .map((version) => ({
        version: version.version,
        date: (version.published_at ?? version.created_at).slice(0, 10),
        notes: version.release_notes ? version.release_notes.split(/\r?\n/).filter(Boolean) : [],
        status: version.status,
      }));
    const databasePriceEur = Number(row.price_eur ?? existingProduct?.price ?? 0);
    const databasePriceXof = Number(row.price_xof ?? existingProduct?.priceXof ?? Math.round(databasePriceEur * 655.957));
    if (
      !Number.isFinite(databasePriceEur)
      || databasePriceEur < 0
      || !Number.isSafeInteger(databasePriceXof)
      || databasePriceXof < 0
    ) {
      console.error("Catalogue product has invalid prices:", row.id);
      throw new Error("Un prix du catalogue n’est pas valide.");
    }
    const priceEur = databasePriceEur;
    const priceXof = databasePriceXof;
    const zipFile = row.zip_path?.split("/").pop() ?? "";

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      domain: row.domain ?? existingProduct?.domain ?? "Général",
      catalogStatus: row.catalog_status ?? (row.status === "published" ? "disponible" : "en_preparation"),
      tagline: existingProduct?.tagline ?? row.description,
      description: row.description || existingProduct?.description || "",
      problem: existingProduct?.problem ?? row.description,
      stack: existingProduct?.stack ?? ["Claude", "ChatGPT"],
      installSteps: existingProduct?.installSteps ?? [
        "Téléchargez le format adapté à votre assistant.",
        "Suivez le guide d’installation fourni avec le skill.",
      ],
      price: priceEur,
      priceXof,
      version: row.version ?? existingProduct?.version ?? "1.0.0",
      status: row.status,
      zipFile,
      isMemberSkill: memberSkillProductIds.has(row.id),
      includedSkills: bundleNamesByProductId.get(row.id) ?? [],
      compatibleAgents: existingProduct?.compatibleAgents ?? ["Claude", "ChatGPT"],
      versions: publishedVersions.length ? publishedVersions : existingProduct?.versions ?? [],
    };
  });

  return products.sort((left, right) => {
    const bundleRank = Number(Boolean(right.includedSkills?.length)) - Number(Boolean(left.includedSkills?.length));
    return bundleRank || Number(right.slug === "go-pro-mlm") - Number(left.slug === "go-pro-mlm");
  });
}

export type CatalogSkillPreview = {
  id: string;
  slug: string;
  name: string;
  short_description: string;
  price_cents: number;
  skill_categories: { name: string; slug: string } | { name: string; slug: string }[] | null;
};

export async function getUpcomingCatalogSkills(): Promise<CatalogSkillPreview[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return [];

  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const { data, error } = await supabase
    .from("skills")
    .select("id,slug,name,short_description,price_cents,product_id,skill_categories(name,slug)")
    .eq("is_active", true)
    .is("product_id", null)
    .order("name");

  if (error) {
    console.error("Could not load upcoming catalog skills:", error.message);
    return [];
  }
  return (data ?? []) as CatalogSkillPreview[];
}

export async function getCatalogProductBySlug(slug: string): Promise<Product | undefined> {
  const products = await getCatalogProducts();
  return products.find((product) => product.slug === slug);
}
