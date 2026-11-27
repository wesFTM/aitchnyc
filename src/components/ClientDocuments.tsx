"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/LanguageProvider";
import { sendJson } from "@/lib/client-api";
import { formatAddress } from "@/lib/format";
import { fieldClass, labelClass, secondaryButtonClass } from "@/lib/styles";
import type { PropertyListItem } from "@/lib/types";

const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,image/jpeg,image/png,image/webp,image/gif";

export type ClientDocumentItem = {
  id: string;
  propertyId: string;
  name: string;
  label: string;
};

export function ClientDocuments({
  clientId,
  properties,
  documents,
  readOnly,
}: {
  clientId: string;
  properties: PropertyListItem[];
  documents: ClientDocumentItem[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [rows, setRows] = useState(documents);
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const incomingKey = documents.map((document) => `${document.id}:${document.propertyId}:${document.name}`).join("|");

  useEffect(() => {
    setRows(documents);
  }, [incomingKey, documents]);

  if (readOnly && rows.length === 0) return null;

  const choices = [...properties].sort((left, right) =>
    formatAddress(left.address, left.unit).localeCompare(formatAddress(right.address, right.unit)),
  );

  async function attach() {
    if (!file || !propertyId) return;
    setPending(true);
    setError(null);
    const body = new FormData();
    body.set("file", file);
    body.set("propertyId", propertyId);
    try {
      const saved = await fetch(`/api/clients/${clientId}/documents`, { method: "POST", body }).then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as { error?: string; id?: string; name?: string; propertyId?: string };
        if (!response.ok || !data.id || !data.name || !data.propertyId) {
          throw new Error(data.error || t("client.docAttachFailed"));
        }
        return data;
      });
      const listing = choices.find((property) => property.id === saved.propertyId);
      setRows((current) => [
        {
          id: saved.id!,
          propertyId: saved.propertyId!,
          name: saved.name!,
          label: listing ? formatAddress(listing.address, listing.unit) : t("client.docListing"),
        },
        ...current,
      ]);
      setFile(null);
      setFileKey((current) => current + 1);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("client.docAttachFailed"));
    } finally {
      setPending(false);
    }
  }

  async function assign(documentId: string, nextPropertyId: string) {
    const previous = rows;
    setRows((current) => current.map((row) => (row.id === documentId ? { ...row, propertyId: nextPropertyId } : row)));
    setError(null);
    try {
      await sendJson(`/api/clients/${clientId}/documents/${documentId}`, "PATCH", { propertyId: nextPropertyId });
      router.refresh();
    } catch (caught) {
      setRows(previous);
      setError(caught instanceof Error ? caught.message : t("client.docChangeFailed"));
    }
  }

  async function remove(documentId: string) {
    const previous = rows;
    setRows((current) => current.filter((row) => row.id !== documentId));
    setError(null);
    try {
      await sendJson(`/api/clients/${clientId}/documents/${documentId}`, "DELETE");
      router.refresh();
    } catch (caught) {
      setRows(previous);
      setError(caught instanceof Error ? caught.message : t("client.docRemoveFailed"));
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <span className={labelClass}>{t("listings.documents")}</span>
      <p className="text-xs text-neutral-500">{t("client.docHelp")}</p>
      {!readOnly && (
        <div className="mt-3 space-y-2">
          {choices.length === 0 ? (
            <p className="text-sm text-neutral-500">{t("client.docNeedListing")}</p>
          ) : (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <input
                key={fileKey}
                className="block min-w-0 flex-1 text-sm text-neutral-600 file:mr-3 file:rounded-full file:border file:border-neutral-600 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-black hover:file:border-black"
                type="file"
                accept={ACCEPT}
                aria-label={t("client.docFile")}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <select
                className={`${fieldClass} w-auto max-w-full`}
                aria-label={t("client.docListing")}
                value={propertyId}
                onChange={(event) => setPropertyId(event.target.value)}
              >
                {choices.map((property) => (
                  <option key={property.id} value={property.id}>
                    {formatAddress(property.address, property.unit)}
                  </option>
                ))}
              </select>
              <button className={secondaryButtonClass} type="button" disabled={pending || !file || !propertyId} onClick={attach}>
                {pending ? t("client.attaching") : t("client.attach")}
              </button>
            </div>
          )}
        </div>
      )}
      {rows.length > 0 && (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => {
            const known = choices.some((property) => property.id === row.propertyId);
            return (
              <li key={row.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <a
                  className="min-w-0 truncate text-sm font-medium underline"
                  href={`/api/clients/${clientId}/documents/${row.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {row.name}
                </a>
                {readOnly ? (
                  <span className="truncate text-xs text-neutral-500">{row.label}</span>
                ) : (
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <select
                      className={`${fieldClass} w-auto max-w-full`}
                      aria-label={t("client.docListingFor", { name: row.name })}
                      value={row.propertyId}
                      onChange={(event) => assign(row.id, event.target.value)}
                    >
                      {!known && <option value={row.propertyId}>{row.label}</option>}
                      {choices.map((property) => (
                        <option key={property.id} value={property.id}>
                          {formatAddress(property.address, property.unit)}
                        </option>
                      ))}
                    </select>
                    <button className={secondaryButtonClass} type="button" onClick={() => remove(row.id)}>
                      {t("client.remove")}
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
