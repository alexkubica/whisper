import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function GET(request: Request) {
  const redirectUrl = new URL("/", request.url);
  const response = NextResponse.redirect(redirectUrl);
  const config = getSupabaseConfig();

  if (!config) {
    return response;
  }

  const requestCookies = request.headers.get("cookie") ?? "";
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return requestCookies
          .split(";")
          .map((entry) => entry.trim())
          .filter(Boolean)
          .map((entry) => {
            const separatorIndex = entry.indexOf("=");
            const name = separatorIndex >= 0 ? entry.slice(0, separatorIndex) : entry;
            const value = separatorIndex >= 0 ? entry.slice(separatorIndex + 1) : "";
            return { name, value };
          });
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.signOut();

  return response;
}
