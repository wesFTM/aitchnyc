"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useI18n } from "@/components/LanguageProvider";
import { TypeDeleteDialog } from "@/components/TypeDeleteDialog";
import { sendJson } from "@/lib/client-api";
import type { DealItem } from "@/lib/deal-view";
import { splitListingAddress } from "@/lib/address";
import {
  DEAL_SIDES,
  DEAL_TYPES,
  FEE_PAYERS,
  dealSideLabel,
  dealTypeLabel,
  dollarsInputValue,
  feePayerLabel,
  formatAddress,
  formatDealDate,
  formatDealPlace,
  formatMoney,
} from "@/lib/format";
import { fieldClass, labelClass, buttonClass, secondaryButtonClass } from "@/lib/styles";

const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,image/jpeg,image/png,image/webp,image/gif";

export type PersonOption = { id: string; label: string };
export type ListingOption = { id: string; address: string; unit: string | null };

type Draft = {
  clientId: string;
  propertyId: string;
  address: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
  dealType: string;
  represented: string;
  monthlyRent: string;
  leaseStart: string;
  leaseEnd: string;
  feePayer: string;
  feePayerNote: string;
  advertised: string;
  leadSource: string;
  leadAgentId: string;
};

function emptyDraft(leadAgentId: string): Draft {
  return {
    clientId: "",
    propertyId: "",
    address: "",
    unit: "",
    city: "",
    state: "",
    zip: "",
    dealType: "",
    represented: "",
    monthlyRent: "",
    leaseStart: "",
    leaseEnd: "",
    feePayer: "",
    feePayerNote: "",
    advertised: "",
    leadSource: "",
    leadAgentId,
  };
}

function draftFromDeal(deal: DealItem): Draft {
  return {
    clientId: deal.clientId,
    propertyId: deal.propertyId ?? "",
    address: deal.address,
    unit: deal.unit,
    city: deal.city,
    state: deal.state,
    zip: deal.zip,
    dealType: deal.dealType,
    represented: deal.represented,
    monthlyRent: deal.monthlyRentCents == null ? "" : dollarsInputValue(deal.monthlyRentCents),
    leaseStart: deal.leaseStart ?? "",
    leaseEnd: deal.leaseEnd ?? "",
    feePayer: deal.feePayer,
    feePayerNote: deal.feePayerNote,
    advertised: deal.publiclyAdvertised ? "yes" : "no",
    leadSource: deal.leadSource,
    leadAgentId: deal.leadAgentId ?? "",
  };
}

function payload(draft: Draft) {
  return {
    clientId: draft.clientId,
    propertyId: draft.propertyId || null,
    address: draft.address,
    unit: draft.unit,
    city: draft.city,
    state: draft.state,
    zip: draft.zip,
    dealType: draft.dealType,
    represented: draft.represented,
    monthlyRent: draft.monthlyRent,
    leaseStart: draft.leaseStart,
    leaseEnd: draft.leaseEnd,
    feePayer: draft.feePayer,
    feePayerNote: draft.feePayer === "other" ? draft.feePayerNote : "",
    publiclyAdvertised: draft.advertised,
    leadSource: draft.leadSource,
    leadAgentId: draft.leadAgentId,
  };
}

async function uploadDealFile(dealId: string, file: File, fallback: string) {
  const body = new FormData();
  body.set("file", file);
  const response = await fetch(`/api/deals/${dealId}/documents`, { method: "POST", body });
  const data = (await response.json().catch(() => ({}))) as { error?: string; id?: string; name?: string };
  if (!response.ok || !data.id || !data.name) throw new Error(data.error || fallback);
  return { id: data.id, name: data.name, href: `/api/deals/${dealId}/documents/${data.id}` };
}

export function NewDealForm({
  clients,
  listings,
  agents,
  currentUserId,
}: {
  clients: PersonOption[];
  listings: ListingOption[];
  agents: PersonOption[];
  currentUserId: string;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => emptyDraft(currentUserId));
  const [files, setFiles] = useState<File[]>([]);
  const [fileKey, setFileKey] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const created = await sendJson<{ id: string }>("/api/deals", "POST", payload(draft));
      let docFailed = false;
      for (const file of files) {
        try {
          await uploadDealFile(created.id, file, t("deals.docAttachFailed"));
        } catch {
          docFailed = true;
        }
      }
      setDraft(emptyDraft(currentUserId));
      setFiles([]);
      setFileKey((current) => current + 1);
      setOpen(false);
      setNotice(docFailed ? t("deals.addedDocFailed") : t("deals.added"));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("deals.addFailed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-neutral-800">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="text-lg font-semibold">{t("deals.add")}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-neutral-500 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div className="space-y-4 border-t border-neutral-800 p-4">
          {clients.length === 0 ? (
            <p className="text-sm text-neutral-500">{t("deals.noClients")}</p>
          ) : (
            <>
              <DealFields
                draft={draft}
                setDraft={setDraft}
                clients={clients}
                listings={listings}
                agents={agents}
                showClient
                required
              />
              <div>
                <span className={labelClass}>{t("deals.documents")}</span>
                <p className="text-xs text-neutral-500">{t("deals.docHelp")}</p>
                <input
                  key={fileKey}
                  className="mt-2 block w-full min-w-0 max-w-full text-sm text-neutral-600 file:mr-3 file:rounded-full file:border file:border-neutral-600 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-black hover:file:border-black"
                  type="file"
                  multiple
                  accept={ACCEPT}
                  onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                />
              </div>
              <button className={buttonClass} type="submit" disabled={pending || agents.length === 0}>
                {pending ? t("deals.adding") : t("deals.add")}
              </button>
            </>
          )}
        </div>
      )}
      {error && <p className="px-4 pb-4 text-sm text-red-600">{error}</p>}
      {notice && <p className="px-4 pb-4 text-sm text-neutral-700">{notice}</p>}
    </form>
  );
}

export function DealList({
  deals,
  clients,
  listings,
  agents,
}: {
  deals: DealItem[];
  clients: PersonOption[];
  listings: ListingOption[];
  agents: PersonOption[];
}) {
  return (
    <div className="grid gap-4">
      {deals.map((deal) => (
        <DealCard key={deal.id} deal={deal} clients={clients} listings={listings} agents={agents} showClient />
      ))}
    </div>
  );
}

export function ClientDeals({
  deals,
  clients,
  listings,
  agents,
}: {
  deals: DealItem[];
  clients: PersonOption[];
  listings: ListingOption[];
  agents: PersonOption[];
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      <span className={labelClass}>{t("nav.deals")}</span>
      {deals.length === 0 ? (
        <p className="text-sm text-neutral-500">{t("deals.noneForClient")}</p>
      ) : (
        deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} clients={clients} listings={listings} agents={agents} showClient={false} nested />
        ))
      )}
    </div>
  );
}

function DealCard({
  deal,
  clients,
  listings,
  agents,
  showClient,
  nested = false,
}: {
  deal: DealItem;
  clients: PersonOption[];
  listings: ListingOption[];
  agents: PersonOption[];
  showClient: boolean;
  nested?: boolean;
}) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => draftFromDeal(deal));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const incoming = JSON.stringify(draftFromDeal(deal));

  useEffect(() => {
    setDraft(draftFromDeal(deal));
  }, [incoming, deal]);

  const place = formatDealPlace(deal);

  async function onSave() {
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      await sendJson(`/api/deals/${deal.id}`, "PATCH", payload(draft));
      setNotice(t("deals.saved"));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("deals.saveFailed"));
    } finally {
      setPending(false);
    }
  }

  async function onDelete() {
    setPending(true);
    setError(null);
    try {
      await sendJson(`/api/deals/${deal.id}`, "DELETE");
      setConfirmingDelete(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("deals.deleteFailed"));
      setPending(false);
    }
  }

  return (
    <div className={nested ? "overflow-hidden rounded-xl border border-neutral-200" : "w-full min-w-0 overflow-hidden rounded-2xl border border-neutral-800"}>
      <button
        type="button"
        className="flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="min-w-0 flex-1">
          <span className="block break-words font-semibold">{place}</span>
          <span className="block text-xs text-neutral-500">
            {dealTypeLabel(deal.dealType, locale)}
            {showClient ? ` · ${deal.clientName}` : ""}
            {` · ${deal.leadAgentName?.trim() || t("deals.unassigned")}`}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-neutral-500 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div
          className="space-y-4 border-t border-neutral-200 p-4"
          onKeyDown={(event) => {
            if (event.key === "Enter" && event.target instanceof HTMLElement && event.target.tagName !== "TEXTAREA") {
              event.preventDefault();
            }
          }}
        >
          {deal.canEdit ? (
            <DealFields
              draft={draft}
              setDraft={setDraft}
              clients={clients}
              listings={listings}
              agents={agents}
              showClient={showClient}
              fallbackClientName={deal.clientName}
              fallbackAgentName={deal.leadAgentName}
            />
          ) : (
            <DealFacts deal={deal} showClient={showClient} />
          )}
          <DealDocuments dealId={deal.id} documents={deal.documents} canEdit={deal.canEdit} />
          {deal.canEdit && (
            <div className="flex flex-wrap gap-3">
              <button className={buttonClass} type="button" onClick={onSave} disabled={pending}>
                {pending ? t("deals.saving") : t("deals.save")}
              </button>
              <button
                className="inline-flex items-center justify-center rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={pending}
              >
                {t("deals.delete")}
              </button>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {notice && <p className="text-sm text-neutral-700">{notice}</p>}
        </div>
      )}
      {confirmingDelete && (
        <TypeDeleteDialog
          title={t("deals.deleteTitle", { place })}
          description={t("deals.deleteBody")}
          pending={pending}
          onCancel={() => {
            if (!pending) setConfirmingDelete(false);
          }}
          onConfirm={onDelete}
        />
      )}
    </div>
  );
}

function DealFacts({ deal, showClient }: { deal: DealItem; showClient: boolean }) {
  const { locale, t } = useI18n();
  const rent = deal.monthlyRentCents == null ? null : t("price.perMonth", { money: formatMoney(deal.monthlyRentCents, locale) });
  const payer = feePayerLabel(deal.feePayer, locale);
  const rows: { label: string; value: string }[] = [
    ...(showClient ? [{ label: t("deals.client"), value: deal.clientName }] : []),
    { label: t("deals.type"), value: dealTypeLabel(deal.dealType, locale) },
    { label: t("deals.represented"), value: dealSideLabel(deal.represented, locale) },
    ...(rent ? [{ label: t("deals.rent"), value: rent }] : []),
    ...(deal.leaseStart ? [{ label: t("deals.leaseStart"), value: formatDealDate(deal.leaseStart, locale) }] : []),
    ...(deal.leaseEnd ? [{ label: t("deals.leaseEnd"), value: formatDealDate(deal.leaseEnd, locale) }] : []),
    {
      label: t("deals.feePayer"),
      value: deal.feePayer === "other" && deal.feePayerNote ? `${payer} · ${deal.feePayerNote}` : payer,
    },
    { label: t("deals.advertised"), value: deal.publiclyAdvertised ? t("deals.yes") : t("deals.no") },
    ...(deal.leadSource ? [{ label: t("deals.leadSource"), value: deal.leadSource }] : []),
    { label: t("deals.leadAgent"), value: deal.leadAgentName?.trim() || t("deals.unassigned") },
  ];
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="min-w-0">
          <dt className={labelClass}>{row.label}</dt>
          <dd className="break-words text-sm">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DealFields({
  draft,
  setDraft,
  clients,
  listings,
  agents,
  showClient,
  required = false,
  fallbackClientName,
  fallbackAgentName,
}: {
  draft: Draft;
  setDraft: (next: Draft | ((current: Draft) => Draft)) => void;
  clients: PersonOption[];
  listings: ListingOption[];
  agents: PersonOption[];
  showClient: boolean;
  required?: boolean;
  fallbackClientName?: string;
  fallbackAgentName?: string | null;
}) {
  const { locale, t } = useI18n();
  const patch = (partial: Partial<Draft>) => setDraft((current) => ({ ...current, ...partial }));
  const listingChoices = useMemo(() => {
    const sorted = [...listings].sort((left, right) =>
      formatAddress(left.address, left.unit).localeCompare(formatAddress(right.address, right.unit), locale === "ko" ? "ko" : "en"),
    );
    if (draft.propertyId && !sorted.some((listing) => listing.id === draft.propertyId)) {
      return [{ id: draft.propertyId, address: draft.address, unit: draft.unit || null }, ...sorted];
    }
    return sorted;
  }, [draft.address, draft.propertyId, draft.unit, listings, locale]);
  const clientChoices = useMemo(() => {
    if (draft.clientId && fallbackClientName && !clients.some((client) => client.id === draft.clientId)) {
      return [{ id: draft.clientId, label: fallbackClientName }, ...clients];
    }
    return clients;
  }, [clients, draft.clientId, fallbackClientName]);
  const agentChoices = useMemo(() => {
    if (draft.leadAgentId && fallbackAgentName && !agents.some((agent) => agent.id === draft.leadAgentId)) {
      return [{ id: draft.leadAgentId, label: fallbackAgentName }, ...agents];
    }
    return agents;
  }, [agents, draft.leadAgentId, fallbackAgentName]);

  function onListing(propertyId: string) {
    if (!propertyId) {
      patch({ propertyId: "" });
      return;
    }
    const listing = listingChoices.find((item) => item.id === propertyId);
    if (!listing || (listing.id === draft.propertyId && listing.address === draft.address)) {
      patch({ propertyId });
      return;
    }
    const parts = splitListingAddress(listing.address);
    patch({
      propertyId,
      address: parts.street,
      unit: listing.unit ?? "",
      city: parts.city,
      state: parts.state,
      zip: parts.zip,
    });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {showClient && (
        <Field label={t("deals.client")}>
          <select className={fieldClass} required={required} value={draft.clientId} onChange={(event) => patch({ clientId: event.target.value })}>
            <option value="">{t("deals.chooseClient")}</option>
            {clientChoices.map((client) => (
              <option key={client.id} value={client.id}>
                {client.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label={t("deals.listing")}>
        <select className={fieldClass} value={draft.propertyId} onChange={(event) => onListing(event.target.value)}>
          <option value="">{t("deals.listingManual")}</option>
          {listingChoices.map((listing) => (
            <option key={listing.id} value={listing.id}>
              {formatAddress(listing.address, listing.unit)}
            </option>
          ))}
        </select>
      </Field>
      {draft.propertyId && <p className="text-xs text-neutral-500 sm:col-span-2">{t("deals.listingFilled")}</p>}
      <Field label={t("deals.address")}>
        <input className={fieldClass} required={required} value={draft.address} onChange={(event) => patch({ address: event.target.value })} />
      </Field>
      <Field label={t("deals.unit")}>
        <input className={fieldClass} value={draft.unit} onChange={(event) => patch({ unit: event.target.value })} />
      </Field>
      <Field label={t("deals.city")}>
        <input className={fieldClass} value={draft.city} onChange={(event) => patch({ city: event.target.value })} />
      </Field>
      <Field label={t("deals.state")}>
        <input className={fieldClass} maxLength={2} value={draft.state} onChange={(event) => patch({ state: event.target.value.toUpperCase() })} />
      </Field>
      <Field label={t("deals.zip")}>
        <input className={fieldClass} inputMode="numeric" value={draft.zip} onChange={(event) => patch({ zip: event.target.value })} />
      </Field>
      <Field label={t("deals.type")}>
        <select className={fieldClass} required={required} value={draft.dealType} onChange={(event) => patch({ dealType: event.target.value })}>
          <option value="">{t("deals.chooseType")}</option>
          {DEAL_TYPES.map((type) => (
            <option key={type} value={type}>
              {dealTypeLabel(type, locale)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("deals.represented")}>
        <select className={fieldClass} required={required} value={draft.represented} onChange={(event) => patch({ represented: event.target.value })}>
          <option value="">{t("deals.chooseSide")}</option>
          {DEAL_SIDES.map((side) => (
            <option key={side} value={side}>
              {dealSideLabel(side, locale)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("deals.rent")}>
        <input
          className={fieldClass}
          inputMode="decimal"
          value={draft.monthlyRent}
          onChange={(event) => patch({ monthlyRent: event.target.value })}
          placeholder="8500"
        />
      </Field>
      <Field label={t("deals.leaseStart")}>
        <input className={fieldClass} type="date" value={draft.leaseStart} onChange={(event) => patch({ leaseStart: event.target.value })} />
      </Field>
      <Field label={t("deals.leaseEnd")}>
        <input className={fieldClass} type="date" value={draft.leaseEnd} onChange={(event) => patch({ leaseEnd: event.target.value })} />
      </Field>
      <Field label={t("deals.feePayer")}>
        <select
          className={fieldClass}
          required={required}
          value={draft.feePayer}
          onChange={(event) => patch({ feePayer: event.target.value, feePayerNote: event.target.value === "other" ? draft.feePayerNote : "" })}
        >
          <option value="">{t("deals.choosePayer")}</option>
          {FEE_PAYERS.map((payer) => (
            <option key={payer} value={payer}>
              {feePayerLabel(payer, locale)}
            </option>
          ))}
        </select>
      </Field>
      {draft.feePayer === "other" && (
        <Field label={t("deals.feeNote")}>
          <input className={fieldClass} value={draft.feePayerNote} onChange={(event) => patch({ feePayerNote: event.target.value })} />
        </Field>
      )}
      <Field label={t("deals.advertised")}>
        <select className={fieldClass} required={required} value={draft.advertised} onChange={(event) => patch({ advertised: event.target.value })}>
          <option value="">{t("deals.chooseAdvertised")}</option>
          <option value="yes">{t("deals.yes")}</option>
          <option value="no">{t("deals.no")}</option>
        </select>
      </Field>
      <Field label={t("deals.leadSource")}>
        <input
          className={fieldClass}
          value={draft.leadSource}
          onChange={(event) => patch({ leadSource: event.target.value })}
          placeholder={t("deals.leadSourcePlaceholder")}
        />
      </Field>
      <Field label={t("deals.leadAgent")}>
        <select className={fieldClass} required={required} value={draft.leadAgentId} onChange={(event) => patch({ leadAgentId: event.target.value })}>
          <option value="">{t("deals.chooseAgent")}</option>
          {agentChoices.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.label}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

function DealDocuments({
  dealId,
  documents,
  canEdit,
}: {
  dealId: string;
  documents: DealItem["documents"];
  canEdit: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [rows, setRows] = useState(documents);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const incomingKey = documents.map((document) => `${document.id}:${document.name}`).join("|");

  useEffect(() => {
    setRows(documents);
  }, [incomingKey, documents]);

  if (!canEdit && rows.length === 0) return null;

  async function attach() {
    if (!file) return;
    setPending(true);
    setError(null);
    try {
      const saved = await uploadDealFile(dealId, file, t("deals.docAttachFailed"));
      setRows((current) => [saved, ...current]);
      setFile(null);
      setFileKey((current) => current + 1);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("deals.docAttachFailed"));
    } finally {
      setPending(false);
    }
  }

  async function remove(documentId: string) {
    const previous = rows;
    setRows((current) => current.filter((row) => row.id !== documentId));
    setError(null);
    try {
      await sendJson(`/api/deals/${dealId}/documents/${documentId}`, "DELETE");
      router.refresh();
    } catch (caught) {
      setRows(previous);
      setError(caught instanceof Error ? caught.message : t("deals.docRemoveFailed"));
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <span className={labelClass}>{t("deals.documents")}</span>
      {canEdit && <p className="text-xs text-neutral-500">{t("deals.docHelp")}</p>}
      {canEdit && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            key={fileKey}
            className="block min-w-0 max-w-full text-sm text-neutral-600 file:mr-3 file:rounded-full file:border file:border-neutral-600 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-black hover:file:border-black"
            type="file"
            accept={ACCEPT}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <button className={secondaryButtonClass} type="button" onClick={attach} disabled={pending || !file}>
            {pending ? t("deals.docAttaching") : t("deals.docAttach")}
          </button>
        </div>
      )}
      {rows.length > 0 && (
        <ul className="mt-3 space-y-2">
          {rows.map((document) => (
            <li key={document.id} className="flex min-w-0 items-center justify-between gap-3">
              <a className="min-w-0 break-all text-sm font-medium underline" href={document.href}>
                {document.name}
              </a>
              {canEdit && (
                <button className={secondaryButtonClass} type="button" onClick={() => remove(document.id)}>
                  {t("deals.docRemove")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0 max-w-full">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}
