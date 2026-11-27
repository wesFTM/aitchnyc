"use client";

import { useI18n } from "@/components/LanguageProvider";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  const korean = locale === "ko";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={korean}
      aria-label={t("language.toggle")}
      onClick={() => setLocale(korean ? "en" : "ko")}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-black bg-white px-1.5 py-1 text-[11px] font-bold leading-none text-black ${className}`}
    >
      <span className={korean ? "px-0.5 text-neutral-400" : "px-0.5"}>EN</span>
      <span className="relative h-5 w-9 rounded-full bg-black" aria-hidden>
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${korean ? "left-[18px]" : "left-0.5"}`}
        />
      </span>
      <span className={korean ? "px-0.5" : "px-0.5 text-neutral-400"}>한</span>
    </button>
  );
}
