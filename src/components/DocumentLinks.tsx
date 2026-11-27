"use client";

import { useI18n } from "@/components/LanguageProvider";

export function DocumentLinks({ documents }: { documents: { href: string; name: string }[] }) {
  const { t } = useI18n();
  if (documents.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("listings.documents")}</p>
      <ul className="space-y-1">
        {documents.map((document) => (
          <li key={document.href}>
            <a className="break-all text-sm font-medium underline" href={document.href} target="_blank" rel="noreferrer">
              {document.name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
