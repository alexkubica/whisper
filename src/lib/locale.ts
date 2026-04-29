export const LOCALE_COOKIE = "whisper_locale";

export const SUPPORTED_LOCALES = ["en", "he"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "he";
}

export function getDirection(locale: Locale) {
  return locale === "he" ? "rtl" : "ltr";
}

export function detectPreferredLocale(
  header: string | null | undefined,
): Locale {
  if (!header) {
    return "en";
  }

  return /\bhe\b/i.test(header) ? "he" : "en";
}
