import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  LOCALE_COOKIE,
  detectPreferredLocale,
  isLocale,
} from "@/lib/locale";

export async function proxy(request: NextRequest) {
  const url = new URL(request.url);
  const localeParam = url.searchParams.get("lang");
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const resolvedLocale =
    (isLocale(localeParam) && localeParam) ||
    (isLocale(cookieLocale) && cookieLocale) ||
    detectPreferredLocale(request.headers.get("accept-language"));

  if (isLocale(localeParam)) {
    url.searchParams.delete("lang");

    const redirect = NextResponse.redirect(url);
    redirect.cookies.set(LOCALE_COOKIE, localeParam, {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });

    return redirect;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    const response = NextResponse.next({
      request,
    });

    response.cookies.set(LOCALE_COOKIE, resolvedLocale, {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });

    return response;
  }

  let response = NextResponse.next({
    request,
  });

  response.cookies.set(LOCALE_COOKIE, resolvedLocale, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
