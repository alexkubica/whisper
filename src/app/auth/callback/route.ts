import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/app";
  const redirectTo = new URL(next.startsWith("/") ? next : "/app", requestUrl.origin);

  if (!code) {
    return NextResponse.redirect(redirectTo);
  }

  try {
    const supabase = await createRouteHandlerClient();

    if (!supabase) {
      console.error("Auth callback error: Supabase route handler client was not created");
      return NextResponse.redirect(
        new URL("/login?error=supabase_client_missing", requestUrl.origin),
      );
    }

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Auth callback exchangeCodeForSession error:", error.message);
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin),
      );
    }

    return NextResponse.redirect(redirectTo);
  } catch (error) {
    console.error("Auth callback unexpected error:", error);
    return NextResponse.redirect(
      new URL("/login?error=auth_callback_failed", requestUrl.origin),
    );
  }
}
