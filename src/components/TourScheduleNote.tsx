"use client";

import { useI18n } from "@/components/LanguageProvider";
import { formatTourWhen } from "@/lib/format";

export function TourScheduleNote({ scheduledAt }: { scheduledAt: string }) {
  const { locale, t } = useI18n();
  return (
    <div className="rounded-xl border border-green-600 bg-green-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-green-800">{t("listings.tourScheduled")}</p>
      <p className="text-sm font-semibold text-black">{formatTourWhen(scheduledAt, locale)}</p>
    </div>
  );
}
