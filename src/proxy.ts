import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase n'est pas configuré pour l'actualisation des sessions.");
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user) {
    if (error && error.message !== "Auth session missing!") {
      console.error("Could not refresh protected page session:", error.message);
    }

    const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    const redirect = NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(nextPath)}`, request.url),
    );
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  if (request.nextUrl.pathname.startsWith("/admin")) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Could not verify admin page role:", profileError.message);
      return new Response("Impossible de vérifier vos droits.", {
        status: 503,
        headers: { "Cache-Control": "private, no-store" },
      });
    }
    if (profile?.role !== "admin") {
      return new Response(
        "<!doctype html><html lang=\"fr\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>Accès refusé</title><main><h1>Accès refusé</h1><p>Cette page est réservée aux administrateurs SkillFlow.</p><a href=\"/\">Retour à l’accueil</a></main></html>",
        {
          status: 403,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "private, no-store",
          },
        },
      );
    }
  }

  return response;
}

export const config = {
  matcher: ["/account/:path*", "/admin/:path*"],
};
