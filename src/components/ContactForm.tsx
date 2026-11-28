"use client";

import { useState } from "react";
import { useI18n } from "@/components/LanguageProvider";
import { sendJson } from "@/lib/client-api";
import type { MessageKey } from "@/lib/messages";
import { buttonClass, fieldClass, labelClass } from "@/lib/styles";

const ERRORS: Record<string, MessageKey> = {
  name: "contact.error.name",
  email: "contact.error.email",
  phone: "contact.error.phone",
  listing: "contact.error.listing",
  message: "contact.error.message",
  send: "contact.failed",
};

export function ContactForm({ listings }: { listings: { id: string; label: string }[] }) {
  const { t } = useI18n();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setError(null);
    try {
      await sendJson("/api/contact", "POST", {
        firstName: data.get("firstName"),
        lastName: data.get("lastName"),
        email: data.get("email"),
        phone: data.get("phone"),
        propertyId: data.get("propertyId"),
        message: data.get("message"),
        company: data.get("company"),
      });
      setSent(true);
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "";
      setError(t(ERRORS[code] ?? "contact.failed"));
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-3xl border border-neutral-200 bg-white px-6 py-16 text-center shadow-sm sm:px-10">
        <p className="text-2xl font-semibold">{t("contact.sentTitle")}</p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-neutral-600">{t("contact.sentBody")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="relative rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>{t("contact.firstName")}</span>
          <input name="firstName" required maxLength={80} autoComplete="given-name" className={fieldClass} />
        </label>
        <label className="block">
          <span className={labelClass}>{t("contact.lastName")}</span>
          <input name="lastName" required maxLength={80} autoComplete="family-name" className={fieldClass} />
        </label>
        <label className="block">
          <span className={labelClass}>{t("contact.email")}</span>
          <input name="email" type="email" required maxLength={160} autoComplete="email" className={fieldClass} />
        </label>
        <label className="block">
          <span className={labelClass}>{t("contact.phone")}</span>
          <input name="phone" type="tel" required maxLength={40} autoComplete="tel" className={fieldClass} />
        </label>
      </div>
      <label className="mt-4 block">
        <span className={labelClass}>{t("contact.listing")}</span>
        <select name="propertyId" className={fieldClass} defaultValue="">
          <option value="">{t("contact.listingGeneral")}</option>
          {listings.map((listing) => (
            <option key={listing.id} value={listing.id}>
              {listing.label}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-4 block">
        <span className={labelClass}>{t("contact.message")}</span>
        <textarea name="message" required maxLength={2000} rows={5} className={`${fieldClass} resize-y`} />
      </label>
      <label className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
        Company
        <input name="company" tabIndex={-1} autoComplete="off" />
      </label>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={pending} className={`${buttonClass} mt-6 px-6 py-2.5`}>
        {pending ? t("contact.sending") : t("contact.send")}
      </button>
    </form>
  );
}
