"use client";

import { useI18n } from "@/components/LanguageProvider";
import { formatSentAt } from "@/lib/format";
import type { MessageKey } from "@/lib/messages";
import type { ContactInquiry } from "@/lib/types";

const INQUIRY_LABELS: Record<string, MessageKey> = {
  general: "contact.inquiry.general",
  commercial: "contact.inquiry.commercial",
  residential: "contact.inquiry.residential",
};

function emailList(inquiries: ContactInquiry[]) {
  const people = new Map<string, { email: string; name: string; phone: string; count: number; first: string; last: string }>();
  for (const inquiry of inquiries) {
    const key = inquiry.email.toLowerCase();
    const name = `${inquiry.first_name} ${inquiry.last_name}`.trim();
    const current = people.get(key);
    if (!current) {
      people.set(key, {
        email: inquiry.email,
        name,
        phone: inquiry.phone,
        count: 1,
        first: inquiry.created_at,
        last: inquiry.created_at,
      });
      continue;
    }
    current.count += 1;
    current.first = inquiry.created_at;
  }
  return [...people.values()];
}

export function MessageInbox({ inquiries }: { inquiries: ContactInquiry[] }) {
  const { locale, t } = useI18n();
  const people = emailList(inquiries);

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-800">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-200 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold">{t("inbox.title")}</h2>
          <p className="mt-1 text-sm text-neutral-500">{t("inbox.messages", { count: inquiries.length })}</p>
        </div>
      </div>
      {inquiries.length === 0 ? (
        <p className="px-5 py-8 text-sm text-neutral-500">{t("inbox.empty")}</p>
      ) : (
        <ul className="max-h-[32rem] divide-y divide-neutral-100 overflow-y-auto">
          {inquiries.map((inquiry) => (
            <li key={inquiry.id} className="px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="font-semibold">
                  {inquiry.first_name} {inquiry.last_name}
                </p>
                <p className="text-xs text-neutral-500">
                  {t("inbox.sent")} {formatSentAt(inquiry.created_at, locale)}
                </p>
              </div>
              <p className="mt-1 text-sm text-neutral-600">
                <a className="underline" href={`mailto:${inquiry.email}`}>
                  {inquiry.email}
                </a>
                <span className="text-neutral-300"> · </span>
                <a className="underline" href={`tel:${inquiry.phone}`}>
                  {inquiry.phone}
                </a>
              </p>
              {(inquiry.inquiry_type || inquiry.neighborhood || inquiry.budget) && (
                <p className="mt-1 text-sm text-neutral-500">
                  {[
                    INQUIRY_LABELS[inquiry.inquiry_type] ? t(INQUIRY_LABELS[inquiry.inquiry_type]) : inquiry.inquiry_type,
                    inquiry.neighborhood,
                    inquiry.budget,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              {inquiry.listing_label ? <p className="mt-1 text-sm text-neutral-500">{inquiry.listing_label}</p> : null}
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{inquiry.message}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-neutral-800 px-5 py-4">
        <h3 className="text-sm font-semibold">{t("inbox.emailList")}</h3>
        <p className="mt-1 text-sm text-neutral-500">{t("inbox.emailListHelp")}</p>
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
          {t("inbox.people", { count: people.length })}
        </p>
      </div>
      {people.length === 0 ? (
        <p className="px-5 pb-6 text-sm text-neutral-500">{t("inbox.emailEmpty")}</p>
      ) : (
        <div className="max-h-80 overflow-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <tbody>
              {people.map((person) => (
                <tr key={person.email} className="border-t border-neutral-100">
                  <td className="px-5 py-3 font-medium">{person.name}</td>
                  <td className="px-3 py-3">
                    <a className="underline" href={`mailto:${person.email}`}>
                      {person.email}
                    </a>
                  </td>
                  <td className="px-3 py-3 text-neutral-600">{person.phone}</td>
                  <td className="px-3 py-3 text-neutral-500">{t("inbox.messages", { count: person.count })}</td>
                  <td className="px-5 py-3 text-right text-neutral-500">{formatSentAt(person.last, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
