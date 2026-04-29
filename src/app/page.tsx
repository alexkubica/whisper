import Link from "next/link";
import { cookies } from "next/headers";
import { WaitlistForm } from "@/components/waitlist-form";
import {
  LOCALE_COOKIE,
  type Locale,
  getDirection,
  isLocale,
} from "@/lib/locale";

const copy = {
  en: {
    appLink: "Open app",
    planLink: "Pricing",
    eyebrow: "Audio to text",
    titleA: "Transcribe audio.",
    titleB: "Read the text.",
    intro:
      "Miluli turns audio and voice notes into text.",
    ctaPrimary: "See pricing",
    sideTitle: "What it does",
    outcomeCards: [
      "Upload audio or video.",
      "Get a clean transcript.",
      "Copy the text and move on.",
    ],
    features: [
      {
        title: "Upload",
        body: "Pick an audio or video file from your device.",
      },
      {
        title: "Transcribe",
        body: "Miluli turns the recording into text.",
      },
      {
        title: "Copy",
        body: "Take the transcript wherever you need it.",
      },
    ],
    pricingEyebrow: "Pricing",
    pricingTitle: "One dollar a month.",
    pricingBody:
      'Roughly 2 hours of recordings every month. For long voice notes that keep piling up, that is the difference between “I’ll listen later” and actually getting through them.',
    valuePoints: [
      "About 2 hours of recordings every month.",
      "Enough for the voice notes that pile up in family, work, and group chats.",
      "Built for the moments when reading is simply faster than listening.",
    ],
    cardPlan: "Miluli personal",
    cardBadge: "Monthly plan",
    cardPeriod: "per month",
    line1Label: "Monthly transcription",
    line1Value: "$1.00",
    line2Label: "Up to about 2 hours of audio",
    line2Value: "Included",
    line3Label: "Charge today",
    line3Value: "$1.00",
  },
  he: {
    appLink: "לאפליקציה",
    planLink: "מחירון",
    eyebrow: "אודיו לטקסט",
    titleA: "מתמללים אודיו.",
    titleB: "קוראים טקסט.",
    intro:
      "Miluli הופך אודיו והודעות קוליות לטקסט.",
    ctaPrimary: "כמה זה עולה?",
    sideTitle: "מה זה עושה",
    outcomeCards: [
      "מעלים אודיו או וידאו.",
      "מקבלים תמלול נקי.",
      "מעתיקים את הטקסט וממשיכים.",
    ],
    features: [
      {
        title: "מעלים",
        body: "בוחרים קובץ אודיו או וידאו מהמכשיר.",
      },
      {
        title: "מתמללים",
        body: "Miluli הופך את ההקלטה לטקסט.",
      },
      {
        title: "מעתיקים",
        body: "לוקחים את התמלול לכל מקום שצריך.",
      },
    ],
    pricingEyebrow: "מחיר",
    pricingTitle: "דולר אחד בחודש.",
    pricingBody:
      "בערך שעתיים של הקלטות בכל חודש. בשביל הודעות קוליות ארוכות שממשיכות להצטבר, זה ההבדל בין “אקשיב אחר כך” לבין באמת לעבור עליהן.",
    valuePoints: [
      "בערך שעתיים של הקלטות בכל חודש.",
      "מספיק להודעות הקוליות שמצטברות במשפחה, בעבודה ובקבוצות.",
      "מיועד לרגעים שבהם לקרוא פשוט מהיר יותר מלשמוע.",
    ],
    cardPlan: "Miluli אישי",
    cardBadge: "חבילה חודשית",
    cardPeriod: "לחודש",
    line1Label: "תמלול חודשי",
    line1Value: "$1.00",
    line2Label: "עד כ־2 שעות שמע",
    line2Value: "כלול",
    line3Label: "חיוב היום",
    line3Value: "$1.00",
  },
} satisfies Record<Locale, unknown>;

function localeHref(locale: Locale, redirectTo: string) {
  return `/api/locale?locale=${locale}&redirectTo=${encodeURIComponent(redirectTo)}`;
}

export default async function Home() {
  const cookieStore = await cookies();
  const localeValue = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(localeValue) ? localeValue : "en";
  const t = copy[locale];

  return (
    <main
      className="min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f5f8ff_0%,#eef4ff_40%,#f7f9fc_100%)] text-slate-950"
      dir={getDirection(locale)}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between py-4">
          <Link className="text-lg font-semibold tracking-[-0.04em]" href="/">
            Miluli
          </Link>
          <div className="flex items-center gap-3">
            <Link
              className="hidden rounded-full px-4 py-2 text-sm text-slate-600 transition hover:bg-white/70 sm:inline-flex"
              href="/app"
            >
              {t.appLink}
            </Link>
            <div className="flex items-center rounded-full border border-slate-200 bg-white/70 p-1">
              <a
                className={`rounded-full px-3 py-1.5 text-sm transition ${
                  locale === "en" ? "bg-slate-950 text-white" : "text-slate-600"
                }`}
                href={localeHref("en", "/")}
              >
                EN
              </a>
              <a
                className={`rounded-full px-3 py-1.5 text-sm transition ${
                  locale === "he" ? "bg-slate-950 text-white" : "text-slate-600"
                }`}
                href={localeHref("he", "/")}
              >
                HE
              </a>
            </div>
            <a
              className="inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              href="#pricing"
            >
              {t.planLink}
            </a>
          </div>
        </header>

        <section className="relative flex flex-1 flex-col justify-center py-16 lg:py-24">
          <div className="absolute inset-x-0 top-4 -z-10 h-[28rem] rounded-[3rem] bg-[radial-gradient(circle_at_top,rgba(89,140,255,0.18),transparent_58%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.92),transparent_32%)] blur-2xl" />
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_24rem] lg:items-end">
            <div className="max-w-4xl">
              <p className="mb-5 text-sm font-medium uppercase tracking-[0.24em] text-slate-500">
                {t.eyebrow}
              </p>
              <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.08em] text-slate-950 sm:text-6xl lg:text-7xl">
                {t.titleA}
                <br />
                {t.titleB}
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
                {t.intro}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  className="inline-flex min-h-12 items-center rounded-full bg-slate-950 px-6 text-sm font-medium text-white transition hover:bg-slate-800"
                  href="#pricing"
                >
                  {t.ctaPrimary}
                </a>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/70 bg-white/70 p-5 shadow-[0_24px_80px_rgba(48,67,115,0.14)] backdrop-blur">
              <div className="rounded-[1.75rem] bg-slate-950 p-5 text-white">
                <p className="text-sm text-white/60">{t.sideTitle}</p>
                <div className="mt-5 space-y-3">
                  {t.outcomeCards.map((item) => (
                    <div
                      key={item}
                      className="rounded-[1.25rem] border border-white/10 bg-white/8 px-4 py-3 text-sm leading-6 text-white/92"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 py-8 lg:grid-cols-3">
          {t.features.map((item) => (
            <article
              key={item.title}
              className="rounded-[2rem] border border-slate-200/70 bg-white/75 p-6 shadow-[0_18px_60px_rgba(77,101,153,0.08)] backdrop-blur"
            >
              <h2 className="text-xl font-semibold tracking-[-0.05em] text-slate-950">
                {item.title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
            </article>
          ))}
        </section>

        <section
          className="mt-8 grid gap-8 rounded-[2.5rem] border border-slate-200/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(244,248,255,0.88))] p-6 shadow-[0_28px_90px_rgba(63,91,156,0.12)] sm:p-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:p-10"
          id="pricing"
        >
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-sky-700">
              {t.pricingEyebrow}
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.07em] text-slate-950 sm:text-5xl">
              {t.pricingTitle}
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">{t.pricingBody}</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {t.valuePoints.map((item) => (
                <div
                  key={item}
                  className="rounded-[1.5rem] border border-slate-200 bg-white/85 px-4 py-4 text-sm leading-6 text-slate-700"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] bg-slate-950 p-6 text-white" id="waitlist">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <p className="text-sm text-white/60">{t.cardPlan}</p>
                <p className="mt-4 text-5xl font-semibold tracking-[-0.08em]">$1</p>
                <p className="mt-2 text-sm text-white/70">{t.cardPeriod}</p>
              </div>
              <div className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs text-white/70">
                {t.cardBadge}
              </div>
            </div>
            <div className="space-y-3 py-5 text-sm text-white/82">
              <div className="flex items-center justify-between gap-3">
                <span>{t.line1Label}</span>
                <span>{t.line1Value}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>{t.line2Label}</span>
                <span>{t.line2Value}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>{t.line3Label}</span>
                <span>{t.line3Value}</span>
              </div>
            </div>
            <div className="rounded-[1.5rem] bg-white/6 p-4">
              <WaitlistForm locale={locale} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
