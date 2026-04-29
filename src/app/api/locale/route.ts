import { NextResponse } from "next/server";
import { LOCALE_COOKIE, isLocale } from "@/lib/locale";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale");
  const redirectTo = url.searchParams.get("redirectTo") || "/";
  const safeRedirect = redirectTo.startsWith("/") ? redirectTo : "/";

  if (!isLocale(locale)) {
    return NextResponse.redirect(new URL(safeRedirect, request.url));
  }

  const response = NextResponse.redirect(new URL(safeRedirect, request.url));

  response.cookies.set(LOCALE_COOKIE, locale, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  return response;
}
