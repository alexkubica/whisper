"use client";

import { useState } from "react";
import { WaitlistForm } from "@/components/waitlist-form";
import type { Locale } from "@/lib/locale";

const copy = {
  en: {
    signInTitle: "Sign in to open the app",
    signInBody: "Use Google to access your transcripts and uploads.",
    signInAction: "Sign in",
    whitelistTitle: "You're not on the whitelist yet",
    whitelistBody:
      "Leave your details and we'll reach out when access opens.",
  },
  he: {
    signInTitle: "צריך להתחבר כדי לפתוח את האפליקציה",
    signInBody: "התחברו עם Google כדי לגשת לתמלולים ולהעלאות שלכם.",
    signInAction: "התחברות",
    whitelistTitle: "עדיין לא קיבלתם גישה",
    whitelistBody: "השיארו פרטים ונעדכן כשהגישה תפתח",
  },
} satisfies Record<
  Locale,
  {
    signInAction: string;
    signInBody: string;
    signInTitle: string;
    whitelistBody: string;
    whitelistTitle: string;
  }
>;

export function AppSignInGate({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const [showWhitelist] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    return hash.get("error_code") === "signup_disabled";
  });

  return (
    <section className="w-full max-w-xl rounded-[1.75rem] border border-white/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.94),rgba(239,245,255,0.84))] p-6 text-center shadow-[0_18px_60px_rgba(76,101,151,0.08)] sm:p-8">
      <h1 className="text-3xl font-semibold tracking-[-0.06em] text-slate-950 sm:text-4xl">
        {showWhitelist ? t.whitelistTitle : t.signInTitle}
      </h1>
      <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
        {showWhitelist ? t.whitelistBody : t.signInBody}
      </p>
      {showWhitelist ? (
        <div className="mt-8 rounded-[1.5rem] bg-slate-950 p-4 text-white">
          <WaitlistForm hideToggle locale={locale} startOpen />
        </div>
      ) : (
        <a
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-slate-950 px-6 text-sm font-medium text-white transition hover:bg-slate-800"
          href="/auth/login?next=/app"
        >
          {t.signInAction}
        </a>
      )}
    </section>
  );
}
