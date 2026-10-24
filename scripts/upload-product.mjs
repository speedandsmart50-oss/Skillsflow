import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.");
}

const archivePath = resolve(
  process.cwd(),
  "product-packs",
  "releases",
  "prospection-ethique-v1.0.0.zip",
);
const archive = await readFile(archivePath);
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
});

const { error } = await supabase.storage
  .from("product-packs")
  .upload("prospection-ethique/prospection-ethique-v1.0.0.zip", archive, {
    contentType: "application/zip",
    upsert: true,
  });

if (error) {
  throw new Error(`Could not upload the product archive: ${error.message}`);
}

console.log("Product archive uploaded to private Supabase Storage.");
