import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { recordAdminAction, requireAdminApiUser } from "@/lib/security/admin-api";
import { validateSlug } from "@/lib/security/access";

const SKILL_STATUSES = new Set(["a_venir", "en_preparation", "disponible"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: Request) {
  const access = await requireAdminApiUser(request);
  if (!access.ok) return access.response;

  const { data: skills, error: skillError } = await access.supabase
    .from("products")
    .select("id, slug, name, description, domain, status, catalog_status, price_eur, price_xof, version, zip_path, archived_at, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (skillError) {
    console.error("Could not load admin catalogue:", skillError.message);
    return NextResponse.json({ error: "Impossible de charger le catalogue." }, { status: 500 });
  }

  const ids = (skills ?? []).map((skill) => skill.id);
  const { data: versions, error: versionError } = ids.length
    ? await access.supabase
      .from("skill_versions")
      .select("id, product_id, version, release_notes, status, published_at, created_at, claude_file_path, chatgpt_file_path, archive_path")
      .in("product_id", ids)
      .order("created_at", { ascending: false })
      .limit(2000)
    : { data: [], error: null };

  if (versionError) {
    console.error("Could not load admin skill versions:", versionError.message);
    return NextResponse.json({ error: "Impossible de charger les versions." }, { status: 500 });
  }

  return NextResponse.json({ skills, versions }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: Request) {
  const access = await requireAdminApiUser(request);
  if (!access.ok) return access.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Les informations du skill sont invalides." }, { status: 400 });
  }

  if (
    !isRecord(body)
    || typeof body.slug !== "string"
    || !validateSlug(body.slug)
    || typeof body.name !== "string"
    || body.name.trim().length < 2
    || body.name.trim().length > 160
    || typeof body.description !== "string"
    || body.description.trim().length > 5000
    || typeof body.domain !== "string"
    || body.domain.trim().length < 2
    || body.domain.trim().length > 120
    || typeof body.priceEur !== "number"
    || !Number.isFinite(body.priceEur)
    || body.priceEur < 0
    || body.priceEur > 99999999
    || typeof body.priceXof !== "number"
    || !Number.isSafeInteger(body.priceXof)
    || body.priceXof < 0
    || typeof body.status !== "string"
    || !SKILL_STATUSES.has(body.status)
  ) {
    return NextResponse.json({ error: "Vérifiez le nom, le domaine, le statut et les deux prix." }, { status: 400 });
  }

  const id = randomUUID();
  const values = {
    id,
    slug: body.slug,
    name: body.name.trim(),
    description: body.description.trim(),
    domain: body.domain.trim(),
    status: "published",
    catalog_status: body.status,
    price: body.priceEur,
    price_eur: body.priceEur,
    price_xof: body.priceXof,
    version: "1.0.0",
  };

  try {
    await recordAdminAction(access.supabase, access.user.id, "catalog.skill.create", "skill", id, "requested", {
      slug: values.slug,
      status: values.catalog_status,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible d’enregistrer cette action." }, { status: 500 });
  }

  const { data, error } = await access.supabase
    .from("products")
    .insert(values)
    .select("id, slug, name, description, domain, status, catalog_status, price_eur, price_xof, version, zip_path, archived_at, created_at, updated_at")
    .single();

  if (error) {
    console.error("Could not create skill:", error.message);
    return NextResponse.json({ error: "Impossible de créer ce skill. Vérifiez que son adresse n’est pas déjà utilisée." }, { status: 409 });
  }

  try {
    await recordAdminAction(access.supabase, access.user.id, "catalog.skill.create", "skill", id, "completed", {
      slug: values.slug,
      status: values.catalog_status,
    });
  } catch (caught) {
    return NextResponse.json({
      error: caught instanceof Error ? caught.message : "Le journal d’audit n’a pas pu confirmer l’action.",
    }, { status: 500 });
  }

  return NextResponse.json({ skill: data }, {
    status: 201,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function PATCH(request: Request) {
  const access = await requireAdminApiUser(request);
  if (!access.ok) return access.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "La modification demandée est invalide." }, { status: 400 });
  }
  if (!isRecord(body) || typeof body.id !== "string" || !UUID_PATTERN.test(body.id)) {
    return NextResponse.json({ error: "Skill introuvable." }, { status: 400 });
  }

  const { data: existing, error: lookupError } = await access.supabase
    .from("products")
    .select("id, slug, name, description, domain, status, catalog_status, price_eur, price_xof, archived_at")
    .eq("id", body.id)
    .maybeSingle();
  if (lookupError) {
    console.error("Could not load skill for update:", lookupError.message);
    return NextResponse.json({ error: "Impossible de charger ce skill." }, { status: 500 });
  }
  if (!existing) return NextResponse.json({ error: "Skill introuvable." }, { status: 404 });

  const update: Record<string, unknown> = {};
  if ("name" in body) {
    if (typeof body.name !== "string" || body.name.trim().length < 2 || body.name.trim().length > 160) {
      return NextResponse.json({ error: "Le nom doit contenir entre 2 et 160 caractères." }, { status: 400 });
    }
    update.name = body.name.trim();
  }
  if ("slug" in body) {
    if (typeof body.slug !== "string" || !validateSlug(body.slug)) {
      return NextResponse.json({ error: "L’adresse du catalogue est invalide." }, { status: 400 });
    }
    update.slug = body.slug;
  }
  if ("description" in body) {
    if (typeof body.description !== "string" || body.description.trim().length > 5000) {
      return NextResponse.json({ error: "La description est trop longue ou invalide." }, { status: 400 });
    }
    update.description = body.description.trim();
  }
  if ("domain" in body) {
    if (typeof body.domain !== "string" || body.domain.trim().length < 2 || body.domain.trim().length > 120) {
      return NextResponse.json({ error: "Le domaine doit contenir entre 2 et 120 caractères." }, { status: 400 });
    }
    update.domain = body.domain.trim();
  }
  if ("priceEur" in body) {
    if (typeof body.priceEur !== "number" || !Number.isFinite(body.priceEur) || body.priceEur < 0 || body.priceEur > 99999999) {
      return NextResponse.json({ error: "Le prix en euros est invalide." }, { status: 400 });
    }
    update.price = body.priceEur;
    update.price_eur = body.priceEur;
  }
  if ("priceXof" in body) {
    if (typeof body.priceXof !== "number" || !Number.isSafeInteger(body.priceXof) || body.priceXof < 0) {
      return NextResponse.json({ error: "Le prix en francs CFA est invalide." }, { status: 400 });
    }
    update.price_xof = body.priceXof;
  }
  if ("status" in body) {
    if (typeof body.status !== "string" || !SKILL_STATUSES.has(body.status)) {
      return NextResponse.json({ error: "Le statut du catalogue est invalide." }, { status: 400 });
    }
    update.catalog_status = body.status;
  }

  const archive = body.archive === true;
  const restore = body.restore === true;
  if ((archive && restore) || (body.archive !== undefined && typeof body.archive !== "boolean")) {
    return NextResponse.json({ error: "Action d’archivage invalide." }, { status: 400 });
  }
  if (archive && body.confirmation !== "ARCHIVER") {
    return NextResponse.json({ error: "Confirmez l’archivage du skill." }, { status: 400 });
  }
  if (restore && body.confirmation !== "RESTAURER") {
    return NextResponse.json({ error: "Confirmez la réactivation du skill." }, { status: 400 });
  }
  const hasChanges = archive || restore || [
    "name",
    "slug",
    "description",
    "domain",
    "priceEur",
    "priceXof",
    "status",
  ].some((field) => field in body);
  if (!hasChanges) {
    return NextResponse.json({ error: "Aucune modification n’a été fournie." }, { status: 400 });
  }
  if (archive) {
    update.archived_at = new Date().toISOString();
    update.status = "draft";
  } else if (restore) {
    update.status = "published";
    update.archived_at = null;
  } else {
    update.status = existing.status;
  }
  update.updated_at = new Date().toISOString();

  const action = archive ? "catalog.skill.archive" : restore ? "catalog.skill.restore" : "catalog.skill.update";
  try {
    await recordAdminAction(access.supabase, access.user.id, action, "skill", existing.id, "requested", {
      changes: Object.keys(update),
      previousStatus: existing.catalog_status,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible d’enregistrer cette action." }, { status: 500 });
  }

  const { data, error } = await access.supabase
    .from("products")
    .update(update)
    .eq("id", existing.id)
    .select("id, slug, name, description, domain, status, catalog_status, price_eur, price_xof, version, zip_path, archived_at, created_at, updated_at")
    .single();

  if (error) {
    console.error("Could not update skill:", error.message);
    return NextResponse.json({ error: "Impossible d’enregistrer les modifications du skill." }, { status: 500 });
  }

  try {
    await recordAdminAction(access.supabase, access.user.id, action, "skill", existing.id, "completed", {
      changes: Object.keys(update),
      status: data.catalog_status,
    });
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : "Le journal d’audit n’a pas pu confirmer l’action." }, { status: 500 });
  }

  return NextResponse.json({ skill: data }, { headers: { "Cache-Control": "private, no-store" } });
}
