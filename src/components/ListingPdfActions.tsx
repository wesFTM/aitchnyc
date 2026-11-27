"use client";

import { useState } from "react";
import { useI18n } from "@/components/LanguageProvider";
import { downloadListingsPdf } from "@/lib/listing-pdf";
import type { ListingPdfSource } from "@/lib/listing-pdf-source";
import { buttonClass, secondaryButtonClass } from "@/lib/styles";

export function DownloadPdfButton({
  listings,
  filename,
  label,
}: {
  listings: ListingPdfSource[];
  filename: string;
  label?: string;
}) {
  const { t } = useI18n();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setPending(true);
    setError(null);
    try {
      await downloadListingsPdf(listings, filename);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("listings.pdfFailed"));
    } finally {
      setPending(false);
    }
  }

  if (listings.length === 0) return null;

  return (
    <div className="space-y-2">
      <button className={secondaryButtonClass} type="button" onClick={onClick} disabled={pending}>
        {pending ? t("listings.makingPdf") : label || t("listings.downloadPdf")}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function PrintListingsButton({ properties }: { properties: { id: string; label: string }[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function savePdf() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/listings/pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ propertyIds: selected }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string; listings?: ListingPdfSource[] } | null;
      if (!response.ok || !body?.listings) {
        throw new Error(body?.error || t("listings.pdfPrepareFailed"));
      }
      await downloadListingsPdf(body.listings, "aitch-listings.pdf");
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("listings.pdfFailed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        className={secondaryButtonClass}
        type="button"
        disabled={properties.length === 0}
        onClick={() => {
          setSelected(properties.map((property) => property.id));
          setError(null);
          setOpen(true);
        }}
      >
        {t("listings.print")}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white p-5 text-black shadow-xl">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">{t("listings.print")}</h2>
              <p className="text-sm text-neutral-500">{t("listings.printHelp")}</p>
            </div>
            <div className="mt-4 flex gap-3 text-sm font-semibold">
              <button type="button" className="underline" onClick={() => setSelected(properties.map((property) => property.id))}>
                {t("listings.selectAll")}
              </button>
              <button type="button" className="underline" onClick={() => setSelected([])}>
                {t("listings.clear")}
              </button>
            </div>
            <ul className="mt-3 min-h-0 flex-1 space-y-2 overflow-auto pr-1">
              {properties.map((property) => (
                <li key={property.id}>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-black"
                      checked={selected.includes(property.id)}
                      onChange={() => toggle(property.id)}
                    />
                    <span>{property.label}</span>
                  </label>
                </li>
              ))}
            </ul>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <div className="mt-4 flex gap-3">
              <button className={buttonClass} type="button" onClick={savePdf} disabled={pending || selected.length === 0}>
                {pending ? t("listings.saving") : t("listings.savePdf")}
              </button>
              <button className={secondaryButtonClass} type="button" onClick={() => setOpen(false)} disabled={pending}>
                {t("listings.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
