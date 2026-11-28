"use client";

import { useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/LanguageProvider";
import { sendJson } from "@/lib/client-api";
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
  const router = useRouter();
  const { locale, t } = useI18n();
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const visible = inquiries.filter((inquiry) => !removedIds.includes(inquiry.id));
  const people = emailList(visible);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  async function remove(id: string) {
    if (!window.confirm(t("inbox.deleteConfirm"))) return;
    setError(null);
    setPendingId(id);
    try {
      await sendJson(`/api/contact/${id}`, "DELETE");
      setRemovedIds((current) => [...current, id]);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("inbox.deleteFailed"));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-800">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        aria-expanded={inboxOpen}
        onClick={() => setInboxOpen((current) => !current)}
      >
        <span>
          <span className="block text-lg font-semibold">{t("inbox.title")}</span>
          <span className="mt-1 block text-sm font-normal text-neutral-500">{t("inbox.messages", { count: visible.length })}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-neutral-500 transition ${inboxOpen ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {inboxOpen && (
        <div className="border-t border-neutral-200">
          {error ? <p className="px-5 pt-4 text-sm text-red-600">{error}</p> : null}
          {visible.length === 0 ? (
            <p className="px-5 py-8 text-sm text-neutral-500">{t("inbox.empty")}</p>
          ) : (
            <ul className="max-h-[32rem] overflow-y-auto">
              {visible.map((inquiry, index) => (
                <li key={inquiry.id} className={`relative px-5 py-4 ${index % 2 === 1 ? "bg-[#e8e8e8]" : "bg-white"}`}>
                  <button
                    type="button"
                    className="absolute right-3 top-3 rounded-full p-1.5 text-neutral-400 hover:bg-black/5 hover:text-red-600 disabled:opacity-40"
                    aria-label={t("inbox.delete")}
                    title={t("inbox.delete")}
                    disabled={pendingId === inquiry.id}
                    onClick={() => remove(inquiry.id)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pr-8">
                    <p className="font-semibold">
                      {inquiry.first_name} {inquiry.last_name}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {t("inbox.sent")} {formatSentAt(inquiry.created_at, locale)}
                    </p>
                  </div>
                  <p className="mt-1 pr-8 text-sm text-neutral-600">
                    <a className="underline" href={`mailto:${inquiry.email}`}>
                      {inquiry.email}
                    </a>
                    <span className="text-neutral-300"> · </span>
                    <a className="underline" href={`tel:${inquiry.phone}`}>
                      {inquiry.phone}
                    </a>
                  </p>
                  {(inquiry.inquiry_type || inquiry.neighborhood || inquiry.budget) && (
                    <p className="mt-1 pr-8 text-sm text-neutral-500">
                      {[
                        INQUIRY_LABELS[inquiry.inquiry_type] ? t(INQUIRY_LABELS[inquiry.inquiry_type]) : inquiry.inquiry_type,
                        inquiry.neighborhood,
                        inquiry.budget,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  {inquiry.listing_label ? <p className="mt-1 pr-8 text-sm text-neutral-500">{inquiry.listing_label}</p> : null}
                  <p className="mt-3 whitespace-pre-wrap pr-8 text-sm leading-6">{inquiry.message}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-neutral-200">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
              aria-expanded={listOpen}
              onClick={() => setListOpen((current) => !current)}
            >
              <span>
                <span className="block text-sm font-semibold">{t("inbox.emailList")}</span>
                <span className="mt-1 block text-sm font-normal text-neutral-500">{t("inbox.people", { count: people.length })}</span>
              </span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-neutral-500 transition ${listOpen ? "rotate-180" : ""}`} aria-hidden />
            </button>
            {listOpen && <p className="px-5 pb-2 text-sm text-neutral-500">{t("inbox.emailListHelp")}</p>}
            {listOpen && people.length === 0 && <p className="px-5 pb-6 text-sm text-neutral-500">{t("inbox.emailEmpty")}</p>}
            {listOpen && people.length > 0 && (
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
          </div>
        </div>
      )}
    </section>
  );
}
