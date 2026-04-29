"use client";

import type { Locale } from "@/lib/locale";
import { useState } from "react";

type WaitlistResponse = {
  success?: boolean;
  error?: string;
};

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function looksLikePhone(value: string) {
  const digits = value.replace(/[^\d+]/g, "");
  return digits.length >= 9;
}

const copy = {
  en: {
    empty: "Enter an email or phone number.",
    invalid: "Enter a valid email or phone number.",
    failed: "Signup failed.",
    success: "You're on the list. We'll let you know when it opens.",
    cta: "Get access",
    body: "This is a waitlist for now. Leave an email or phone number and we’ll reach out when subscriptions open.",
    placeholder: "Email or phone",
    submitting: "Sending...",
    submit: "Join waitlist",
  },
  he: {
    empty: "הכניסו אימייל או מספר טלפון.",
    invalid: "הכניסו אימייל תקין או מספר טלפון.",
    failed: "ההרשמה נכשלה.",
    success: "נרשמתם. נעדכן כשנפתח.",
    cta: "רוצים להצטרף",
    body: "כרגע זו רשימת המתנה. השאירו אימייל או טלפון ונעדכן כשנפתח.",
    placeholder: "אימייל או טלפון",
    submitting: "שולחים...",
    submit: "להצטרף לרשימה",
  },
} satisfies Record<Locale, unknown>;

export function WaitlistForm({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const [contact, setContact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = contact.trim();

    if (!value) {
      setError(t.empty);
      return;
    }

    if (!looksLikeEmail(value) && !looksLikePhone(value)) {
      setError(t.invalid);
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
      <button
        className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-sky-400 px-5 text-sm font-medium text-slate-950 transition hover:bg-sky-300"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        {t.cta}
      </button>

      {isOpen ? (
        <form className="space-y-3" onSubmit={handleSubmit}>
          <p className="text-sm leading-6 text-white/70">{t.body}</p>
          <label className="block">
            <span className="sr-only">{t.placeholder}</span>
            <input
              autoComplete="email"
              className="h-12 w-full rounded-full border border-white/12 bg-white px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-400"
              inputMode="email"
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
