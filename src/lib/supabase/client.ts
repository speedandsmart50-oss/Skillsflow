export const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co",
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "demo-anon-key",
};

export function getSupabaseClient() {
  return {
    url: supabaseConfig.url,
    anonKey: supabaseConfig.anonKey,
    mode: "browser" as const,
  };
}
