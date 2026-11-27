"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { DocumentLinks } from "@/components/DocumentLinks";
import { useI18n } from "@/components/LanguageProvider";
import type { ClientDealView } from "@/lib/deal-view";
import { dealTypeLabel, formatDealDate, formatDealPlace, formatMoney } from "@/lib/format";
import type { Locale } from "@/lib/locale";

export function CurrentDeals({ deals }: { deals: ClientDealView[] }) {
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  if (deals.length === 0) return null;

  return (
    <section className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-neutral-200">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="text-lg font-semibold">{t("deals.current")}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-neutral-500 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div className="space-y-3 border-t border-neutral-200 p-4">
          {deals.map((deal) => (
            <CurrentDeal key={deal.id} deal={deal} locale={locale} />
          ))}
        </div>
      )}
    </section>
  );
}

function CurrentDeal({ deal, locale }: { deal: ClientDealView; locale: Locale }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const place = formatDealPlace(deal);
  const rent =
    deal.monthlyRentCents == null ? null : t("price.perMonth", { money: formatMoney(deal.monthlyRentCents, locale) });

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-neutral-50"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="min-w-0">
          <span className="block break-words text-sm font-semibold">{place}</span>
          <span className="block text-xs text-neutral-500">{dealTypeLabel(deal.dealType, locale)}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-neutral-500 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div className="space-y-3 border-t border-neutral-200 px-3 py-3 text-sm">
          {rent && (
            <p>
              <span className="text-neutral-500">{t("deals.rent")}</span>
              <span className="mt-0.5 block font-medium">{rent}</span>
            </p>
          )}
          {deal.leaseStart && (
            <p>
              <span className="text-neutral-500">{t("deals.leaseStart")}</span>
              <span className="mt-0.5 block font-medium">{formatDealDate(deal.leaseStart, locale)}</span>
            </p>
          )}
          {deal.leaseEnd && (
            <p>
              <span className="text-neutral-500">{t("deals.leaseEnd")}</span>
              <span className="mt-0.5 block font-medium">{formatDealDate(deal.leaseEnd, locale)}</span>
            </p>
          )}
          <DocumentLinks documents={deal.documents} />
        </div>
      )}
    </div>
  );
}
