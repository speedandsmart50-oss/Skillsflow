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
};

type VersionRow = {
  product_id: string;
  version: string;
  release_notes: string | null;
  status: "draft" | "published";
  published_at: string | null;
  created_at: string;
};

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

  return rows.map((row) => {
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
      compatibleAgents: existingProduct?.compatibleAgents ?? ["Claude", "ChatGPT"],
      versions: publishedVersions.length ? publishedVersions : existingProduct?.versions ?? [],
    };
  });
}

export async function getCatalogProductBySlug(slug: string): Promise<Product | undefined> {
  const products = await getCatalogProducts();
  return products.find((product) => product.slug === slug);
}
