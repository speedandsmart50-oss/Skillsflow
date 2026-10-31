import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { consumeApiRateLimit, getRateLimitIpSubjectKey } from "@/lib/security/api-rate-limit";
import { safeNextPath } from "@/lib/security/redirect";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const otpType = request.nextUrl.searchParams.get("type");
  const destination = safeNextPath(request.nextUrl.searchParams.get("next"));
  const response = NextResponse.redirect(new URL(destination, request.url));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const allowedOtpTypes: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change"];
  if ((!code && !(tokenHash && otpType && allowedOtpTypes.includes(otpType as EmailOtpType))) || !url || !anonKey) {
    return NextResponse.redirect(new URL("/login?error=auth_callback", request.url));
  }

  const rateLimitSubject = getRateLimitIpSubjectKey(request);
  if (rateLimitSubject) {
    try {
      const rateLimit = await consumeApiRateLimit(getSupabaseAdminClient(), "auth_ip", rateLimitSubject);
      if (!rateLimit.allowed) {
        return NextResponse.redirect(new URL("/login?error=auth_rate_limited", request.url));
      }
    } catch (error) {
      console.error("Auth rate limit check failed:", error instanceof Error ? error.message : "Unknown error");
      return NextResponse.redirect(new URL("/login?error=auth_callback", request.url));
    }
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies) {
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: otpType as EmailOtpType });
  if (error) return NextResponse.redirect(new URL("/login?error=auth_callback", request.url));
  return response;
}
