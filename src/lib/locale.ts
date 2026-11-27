export type Locale = "en" | "ko";

export const LOCALE_COOKIE = "aitch_locale";

export function parseLocale(value: string | undefined | null): Locale {
  return value === "ko" ? "ko" : "en";
}

export function localeTag(locale: Locale) {
  return locale === "ko" ? "ko-KR" : "en-US";
}
