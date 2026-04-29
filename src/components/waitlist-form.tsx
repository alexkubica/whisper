"use client";

import type { Locale } from "@/lib/locale";
import { useState } from "react";

type WaitlistResponse = {
  success?: boolean;
  error?: string;
};

const copy = {
  en: {
    empty: "Leave a way to reach you.",
    failed: "Signup failed.",
    success: "You're on the list. We'll let you know when it opens.",
    cta: "Get access",
    body: "Leave contact details and we’ll reach out when subscriptions open.",
    placeholder: "Email or phone",
    submitting: "Sending...",
    submit: "Send details",
  },
  he: {
    empty: "השאירו דרך ליצור קשר.",
    failed: "ההרשמה נכשלה.",
    success: "נרשמתם. נעדכן כשנפתח.",
    cta: "אני רוצה!",
    body: "השיארו פרטים ונעדכן כשהגישה תפתח",
    placeholder: "אימייל או טלפון",
    submitting: "שולחים...",
    submit: "שלח פרטים",
  },
} satisfies Record<Locale, unknown>;

export function WaitlistForm({
  hideToggle = false,
  locale,
  startOpen = false,
}: {
  hideToggle?: boolean;
  locale: Locale;
  startOpen?: boolean;
}) {
  const t = copy[locale];
  const [contact, setContact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(startOpen);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = contact.trim();

    if (!value) {
      setError(t.empty);
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ contact: value }),
      });

      const payload = (await response.json()) as WaitlistResponse;

      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? t.failed);
      }

      setMessage(t.success);
      setContact("");
    } catch (responseError) {
      setError(
        responseError instanceof Error
          ? responseError.message
          : t.failed,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {!hideToggle ? (
        <button
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-sky-400 px-5 text-sm font-medium text-slate-950 transition hover:bg-sky-300"
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          {t.cta}
        </button>
      ) : null}

      {isOpen ? (
        <form className="space-y-3" onSubmit={handleSubmit}>
          <p className="text-sm leading-6 text-white/70">{t.body}</p>
          <label className="block">
            <span className="sr-only">{t.placeholder}</span>
            <input
              autoComplete="off"
              className="h-12 w-full rounded-full border border-white/12 bg-white px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-400"
              inputMode="text"
              onChange={(event) => setContact(event.target.value)}
              placeholder={t.placeholder}
              type="text"
              value={contact}
            />
          </label>
          <button
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-white px-5 text-sm font-medium text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-200"
            disabled={submitting}
            type="submit"
          >
            {submitting ? t.submitting : t.submit}
          </button>
          {message ? <p className="text-sm text-sky-300">{message}</p> : null}
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
