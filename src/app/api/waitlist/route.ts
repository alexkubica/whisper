import { cookies } from "next/headers";
import { createWaitlistSignup } from "@/db/queries";
import { hasDatabaseUrl } from "@/lib/env";
import { LOCALE_COOKIE, type Locale, isLocale } from "@/lib/locale";
import { NextResponse } from "next/server";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string) {
  const normalized = value.replace(/[^\d+]/g, "");
  return normalized.length >= 9;
}

const copy = {
  en: {
    notReady: "Waitlist is not configured yet.",
    invalid: "Enter a valid email or phone number.",
    failed: "Signup failed.",
  },
  he: {
    notReady: "רשימת ההמתנה עדיין לא מוכנה.",
    invalid: "הכניסו אימייל תקין או מספר טלפון.",
    failed: "ההרשמה נכשלה.",
  },
} satisfies Record<Locale, unknown>;

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const localeValue = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(localeValue) ? localeValue : "en";
  const t = copy[locale];

  if (!hasDatabaseUrl()) {
    return NextResponse.json(
      { error: t.notReady },
      { status: 503 },
    );
  }

  const body = (await request.json()) as { contact?: string };
  const contact = body.contact?.trim() ?? "";

  if (!contact || (!isValidEmail(contact) && !isValidPhone(contact))) {
    return NextResponse.json({ error: t.invalid }, { status: 400 });
  }

  try {
    const created = await createWaitlistSignup(contact);

    return NextResponse.json({
      success: true,
      duplicate: !created,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: t.failed }, { status: 500 });
  }
}
