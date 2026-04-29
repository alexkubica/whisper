import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

export async function GET(request: Request) {
  const supabase = await createRouteHandlerClient();

  if (!supabase) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const url = new URL(request.url);
  const origin = url.origin;
  const next = url.searchParams.get("next") ?? "/app";

  const { data, error } = await supabase.auth.signInWithOAuth({
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: {
        prompt: "select_account",
      },
    },
    provider: "google",
  });

  if (error || !data.url) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.redirect(data.url);
}
