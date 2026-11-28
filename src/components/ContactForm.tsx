"use client";

import { useState } from "react";
import { useI18n } from "@/components/LanguageProvider";
import { sendJson } from "@/lib/client-api";
import type { MessageKey } from "@/lib/messages";
import { CONTACT_INQUIRY_TYPES } from "@/lib/contact-input";
import { buttonClass, fieldClass, labelClass, NEIGHBORHOODS } from "@/lib/styles";

const ERRORS: Record<string, MessageKey> = {
  name: "contact.error.name",
  email: "contact.error.email",
  phone: "contact.error.phone",
  inquiry: "contact.error.inquiry",
  budget: "contact.error.budget",
  neighborhood: "contact.error.neighborhood",
  message: "contact.error.message",
  send: "contact.failed",
};

export function ContactForm() {
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
        inquiryType: data.get("inquiryType"),
        budget: data.get("budget"),
        neighborhood: data.get("neighborhood"),
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
        <label className="block">
          <span className={labelClass}>{t("contact.inquiry")}</span>
          <select name="inquiryType" required defaultValue="" className={fieldClass}>
            <option value="">{t("contact.choose")}</option>
            {CONTACT_INQUIRY_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`contact.inquiry.${type}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>{t("contact.budget")}</span>
          <input name="budget" required maxLength={80} placeholder={t("contact.budgetHint")} className={fieldClass} />
        </label>
      </div>
      <label className="mt-4 block">
        <span className={labelClass}>{t("contact.neighborhood")}</span>
        <select name="neighborhood" required defaultValue="" className={fieldClass}>
          <option value="">{t("contact.choose")}</option>
          {NEIGHBORHOODS.map((name) => (
            <option key={name} value={name}>
              {name}
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
