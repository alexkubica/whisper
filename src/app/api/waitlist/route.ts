import { cookies } from "next/headers";
import { createWaitlistSignup } from "@/db/queries";
import { hasDatabaseUrl } from "@/lib/env";
import { LOCALE_COOKIE, type Locale, isLocale } from "@/lib/locale";
import { NextResponse } from "next/server";

const MAX_SUBMISSIONS_PER_IP = 3;
const waitlistSubmissionsByIp = new Map<string, number>();
const MAX_CONTACT_LENGTH = 320;

const copy = {
  en: {
    notReady: "Waitlist is not configured yet.",
    invalid: "Enter something so we can reach you.",
    failed: "Signup failed.",
  },
  he: {
    notReady: "רשימת ההמתנה עדיין לא מוכנה.",
    invalid: "השאירו משהו כדי שנוכל לחזור אליכם.",
    failed: "ההרשמה נכשלה.",
  },
} satisfies Record<Locale, unknown>;

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const localeValue = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(localeValue) ? localeValue : "en";
  const t = copy[locale];

  if (process.env.WAITLIST_ENABLED !== "true") {
    return NextResponse.json({ error: t.notReady }, { status: 404 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json(
      { error: t.notReady },
      { status: 503 },
    );
  }

  const body = (await request.json()) as { contact?: string };
  const contact = body.contact?.trim() ?? "";

  if (!contact || contact.length > MAX_CONTACT_LENGTH) {
    return NextResponse.json({ error: t.invalid }, { status: 400 });
  }

  try {
    const ip = getClientIp(request);
    const currentCount = waitlistSubmissionsByIp.get(ip) ?? 0;

    if (currentCount >= MAX_SUBMISSIONS_PER_IP) {
      return NextResponse.json({
        success: true,
        duplicate: true,
      });
    }

    const created = await createWaitlistSignup(contact);
    waitlistSubmissionsByIp.set(ip, currentCount + 1);

    return NextResponse.json({
      success: true,
      duplicate: !created,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: t.failed }, { status: 500 });
  }
}
