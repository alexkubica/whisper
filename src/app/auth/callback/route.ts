import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

export async function GET(request: Request) {
  const supabase = await createRouteHandlerClient();
  const requestUrl = new URL(request.url);
  const next = requestUrl.searchParams.get("next") ?? "/";
  const code = requestUrl.searchParams.get("code");

  if (!supabase || !code) {
    return NextResponse.redirect(new URL(next, request.url));
  }

  await supabase.auth.exchangeCodeForSession(code);

  return NextResponse.redirect(new URL(next, request.url));
}
