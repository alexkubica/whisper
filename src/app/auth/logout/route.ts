import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function GET(request: Request) {
  const redirectUrl = new URL("/", request.url);
  const response = NextResponse.redirect(redirectUrl);
  const config = getSupabaseConfig();
  const requestCookies = request.headers.get("cookie") ?? "";

  if (!config) {
    return response;
  }

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

  for (const entry of requestCookies.split(";")) {
    const trimmed = entry.trim();

    if (!trimmed) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    const name = separatorIndex >= 0 ? trimmed.slice(0, separatorIndex) : trimmed;

    if (name.startsWith("sb-") || name.endsWith("-code-verifier")) {
      response.cookies.set(name, "", {
        expires: new Date(0),
        path: "/",
      });
    }
  }

  return response;
}
