"use client";

/* Logos are user uploads, so skip the image optimizer. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { ClientDocuments, type ClientDocumentItem } from "@/components/ClientDocuments";
import { ClientFlagControl, HideRecordButton, RemoveFromMyListButton } from "@/components/MasterListActions";
import { TypeDeleteDialog } from "@/components/TypeDeleteDialog";
import { sendJson } from "@/lib/client-api";
import { clientLogoUrl } from "@/lib/client-logo";
import { hideStreetNumber } from "@/lib/address";
import { formatAddress, formatTourWhen, listingTypeLabel } from "@/lib/format";
import { buttonClass, fieldClass, labelClass, secondaryButtonClass } from "@/lib/styles";
import type { ListingType, PropertyListItem, User } from "@/lib/types";

const LOGO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const savedClientSnapshots = new Map<string, string>();

function clientFormSnapshot(value: {
  name: string;
  email: string;
  phone: string;
  companyWebsite: string;
  companyZip: string;
  selected: string[];
}) {
  return JSON.stringify({
    name: value.name,
    email: value.email,
    phone: value.phone,
    companyWebsite: value.companyWebsite,
    companyZip: value.companyZip,
    selected: [...value.selected].sort(),
  });
}

export function NewClientForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companyZip, setCompanyZip] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [fileKey, setFileKey] = useState(0);
  const [open, setOpen] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const created = await sendJson<{ id: string }>("/api/clients", "POST", {
        name,
        email,
        phone,
        companyWebsite,
        companyZip,
      });
      let logoNote: string | null = null;
      if (logoFile) {
        await uploadLogoFile(created.id, logoFile);
      } else if (companyWebsite.trim()) {
        try {
          await sendJson(`/api/clients/${created.id}/logo`, "POST", { website: companyWebsite });
        } catch (caught) {
          logoNote = caught instanceof Error ? caught.message : "Couldn't find a logo on that website.";
        }
      }
      setName("");
      setEmail("");
      setPhone("");
      setCompanyWebsite("");
      setCompanyZip("");
      setLogoFile(null);
      setFileKey((current) => current + 1);
      setOpen(false);
      setNotice(logoNote ? `Client added. ${logoNote}` : "Client added.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add that client.");
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
        <span className="text-lg font-semibold">Create Client</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-neutral-500 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open && (
      <div className="space-y-4 border-t border-neutral-800 p-4">
      <div>
        <span className={labelClass}>Company logo</span>
        <input
          key={fileKey}
          className="block w-full min-w-0 max-w-full text-sm text-neutral-600 file:mr-3 file:rounded-full file:border file:border-neutral-600 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-black hover:file:border-black"
          type="file"
          accept={LOGO_TYPES.join(",")}
          onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
        />
        <p className="mt-1 text-xs text-neutral-500">
          Optional. If you leave this empty, we try the company website when the client is added.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <Field label="Email">
          <input
            className={fieldClass}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Optional"
          />
        </Field>
        <Field label="Phone">
          <input
            className={fieldClass}
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="212 555 0100"
          />
        </Field>
        <Field label="Company website">
          <input
            className={fieldClass}
            type="text"
            inputMode="url"
            value={companyWebsite}
            onChange={(event) => setCompanyWebsite(event.target.value)}
            placeholder="https://company.com"
          />
        </Field>
        <Field label="Company zip code">
          <input
            className={fieldClass}
            inputMode="numeric"
            value={companyZip}
            onChange={(event) => setCompanyZip(event.target.value)}
            placeholder="10013"
          />
        </Field>
      </div>
      <button className={buttonClass} type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add client"}
      </button>
      </div>
      )}
      {error && <p className="px-4 pb-4 text-sm text-red-600">{error}</p>}
      {notice && <p className="px-4 pb-4 text-sm text-neutral-700">{notice}</p>}
    </form>
  );
}

export function ClientCard({
  client,
  properties,
  assignedIds,
  hiddenStreetNumberIds = [],
  likedIds,
  tourIds,
  tourSchedules,
  documents = [],
  readOnly = false,
  allowDelete = false,
  allowRemove = false,
  showFlag = false,
  showHide = false,
  editorId = null,
}: {
  client: User;
  properties: PropertyListItem[];
  assignedIds: string[];
  hiddenStreetNumberIds?: string[];
  likedIds: string[];
  tourIds: string[];
  tourSchedules: Record<string, string>;
  documents?: ClientDocumentItem[];
  readOnly?: boolean;
  allowDelete?: boolean;
  allowRemove?: boolean;
  showFlag?: boolean;
  showHide?: boolean;
  editorId?: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(client.name);
  const [email, setEmail] = useState(client.email);
  const [phone, setPhone] = useState(client.phone || "");
  const [companyWebsite, setCompanyWebsite] = useState(client.company_website || "");
  const [companyZip, setCompanyZip] = useState(client.company_zip || "");
  const [logoKey, setLogoKey] = useState(client.logo_key);
  const [selected, setSelected] = useState<string[]>(assignedIds);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [logoPending, setLogoPending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    setLogoKey(client.logo_key);
  }, [client.logo_key]);

  const preview = readOnly
    ? logoKey
      ? `/api/clients/${client.id}/logo?v=${encodeURIComponent(logoKey)}`
      : null
    : clientLogoUrl(client.share_token, logoKey);
  const saved =
    savedClientSnapshots.get(client.id) ===
    clientFormSnapshot({ name, email, phone, companyWebsite, companyZip, selected });

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await sendJson<{ logoFound: boolean | null }>(`/api/clients/${client.id}`, "PATCH", {
        name,
        email,
        phone,
        companyWebsite,
        companyZip,
      });
      await sendJson(`/api/clients/${client.id}/assignments`, "PUT", { propertyIds: selected });
      savedClientSnapshots.set(
        client.id,
        clientFormSnapshot({ name, email, phone, companyWebsite, companyZip, selected }),
      );
      if (saved.logoFound === false) setMessage("Saved. No logo was found on that website.");
      else if (saved.logoFound) setMessage("Saved. Logo added from the company website.");
      else setMessage(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this client.");
    } finally {
      setPending(false);
    }
  }

  async function onDelete() {
    setConfirmingDelete(false);
    setPending(true);
    setError(null);
    try {
      await sendJson(`/api/clients/${client.id}`, "DELETE");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove this client.");
      setPending(false);
    }
  }

  async function onUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) {
      setError("Upload a JPEG, PNG, WebP, or GIF.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Logo images need to be 2MB or smaller.");
      return;
    }
    setLogoPending(true);
    setError(null);
    setMessage(null);
    try {
      const uploaded = await uploadLogoFile(client.id, file);
      setLogoKey(uploaded.logoKey);
      setMessage("Logo updated.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not upload that logo.");
    } finally {
      setLogoPending(false);
    }
  }

  async function onPullLogo() {
    setLogoPending(true);
    setError(null);
    setMessage(null);
    try {
      const uploaded = await sendJson<{ logoKey: string }>(`/api/clients/${client.id}/logo`, "POST", {
        website: companyWebsite,
      });
      setLogoKey(uploaded.logoKey);
      setMessage("Logo added from the company website.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't find a logo on that website.");
    } finally {
      setLogoPending(false);
    }
  }

  async function onRemoveLogo() {
    setLogoPending(true);
    setError(null);
    setMessage(null);
    try {
      await sendJson(`/api/clients/${client.id}/logo`, "DELETE");
      setLogoKey(null);
      setMessage("Logo removed.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove the logo.");
    } finally {
      setLogoPending(false);
    }
  }

  return (
    <>
    <form onSubmit={onSave} className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-neutral-800">
      <button
        type="button"
        className="flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50"
        aria-expanded={cardOpen}
        onClick={() => setCardOpen((current) => !current)}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-800 bg-neutral-50">
          {preview ? (
            <img src={preview} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="px-0.5 text-center text-[8px] font-medium uppercase tracking-wide text-neutral-400">No logo</span>
          )}
        </div>
        <span className="min-w-0 flex-1">
          <span className="block break-words text-lg font-semibold text-black">{name}</span>
          {client.created_by_name && (
            <span className="block text-xs text-neutral-500">{`Added by ${client.created_by_name}`}</span>
          )}
          {Boolean(client.flagged) && (
            <span className="block text-xs font-semibold uppercase tracking-wide text-amber-700">
              Flagged{client.flag_note ? ` · ${client.flag_note}` : ""}
            </span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-neutral-500 transition ${cardOpen ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {cardOpen && (
      <div className="space-y-4 border-t border-neutral-800 p-4">
      {(email.trim() || phone.trim()) && (
        <p className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-sm font-normal text-black">
          {email.trim() && (
            <a className="min-w-0 break-all underline" href={`mailto:${email.trim()}`}>
              {email.trim()}
            </a>
          )}
          {phone.trim() && (
            <a className="min-w-0 break-all underline" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>
              {phone.trim()}
            </a>
          )}
        </p>
      )}
      <ClientLink token={client.share_token} />
      <LikedListings
        clientId={client.id}
        properties={properties}
        likedIds={likedIds}
        tourIds={tourIds}
        tourSchedules={tourSchedules}
        assignedIds={assignedIds}
        readOnly={readOnly}
        editorId={editorId}
      />
      {showHide && (
        <StreetNumbers
          clientId={client.id}
          properties={properties}
          assignedIds={assignedIds}
          hiddenIds={hiddenStreetNumberIds}
        />
      )}
      {readOnly ? (
        <AssignedListings properties={properties} assignedIds={assignedIds} />
      ) : (
        <ListingPicker
          properties={properties}
          selected={selected}
          likedIds={likedIds}
          tourIds={tourIds}
          tourSchedules={tourSchedules}
          onToggle={(id) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))}
        />
      )}
      <ClientDocuments clientId={client.id} properties={properties} documents={documents} readOnly={readOnly} />
      {(showHide || allowRemove || showFlag) && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {showHide && <HideRecordButton kind="client" id={client.id} hidden={Boolean(client.hidden)} />}
            {allowRemove && <RemoveFromMyListButton kind="client" id={client.id} />}
          </div>
          {showFlag && <ClientFlagControl id={client.id} flagged={Boolean(client.flagged)} note={client.flag_note || ""} />}
          {showHide && client.created_by_name && (
            <p className="text-xs text-neutral-500">
              {`This client was added by ${client.created_by_name}. Their page can use that admin's own listing picks. The assignments here stay on the master list.`}
            </p>
          )}
          {!readOnly && editorId && (
            <p className="text-xs text-neutral-500">
              Saving updates this client&apos;s page and your list. It does not change the master record. The logo is shared.
            </p>
          )}
          {readOnly && allowRemove && (
            <p className="text-xs text-neutral-500">
              This client is on your list. Taking them off does not remove them from the master list.
            </p>
          )}
        </div>
      )}
      {!readOnly && (
      <div className="overflow-hidden rounded-xl border border-neutral-800">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-neutral-50"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((current) => !current)}
        >
          <span className="text-sm font-medium">Client details</span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-neutral-500 transition ${detailsOpen ? "rotate-180" : ""}`} />
        </button>
        {detailsOpen && (
          <div className="space-y-4 border-t border-neutral-800 p-3">
            <div className="min-w-0 space-y-2">
              {!logoKey && <span className={labelClass}>Company logo</span>}
              <div className="flex flex-wrap gap-2">
                <label className={`${secondaryButtonClass} cursor-pointer`}>
                  {logoPending ? "Updating…" : "Upload"}
                  <input
                    className="sr-only"
                    type="file"
                    accept={LOGO_TYPES.join(",")}
                    onChange={onUpload}
                    disabled={logoPending || pending}
                  />
                </label>
                <button
                  className={secondaryButtonClass}
                  type="button"
                  onClick={onPullLogo}
                  disabled={logoPending || pending || !companyWebsite.trim()}
                >
                  Use website logo
                </button>
                {logoKey && (
                  <button className={secondaryButtonClass} type="button" onClick={onRemoveLogo} disabled={logoPending || pending}>
                    Remove
                  </button>
                )}
              </div>
              <p className="text-xs text-neutral-500">Shown beside “Current Listings” on their page. Logo changes save right away.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} required />
              </Field>
              <Field label="Email">
                <input
                  className={fieldClass}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Optional"
                />
              </Field>
              <Field label="Phone">
                <input
                  className={fieldClass}
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="212 555 0100"
                />
              </Field>
              <Field label="Company website">
                <input
                  className={fieldClass}
                  type="text"
                  inputMode="url"
                  value={companyWebsite}
                  onChange={(event) => setCompanyWebsite(event.target.value)}
                  placeholder="https://company.com"
                />
              </Field>
              <Field label="Company zip code">
                <input
                  className={fieldClass}
                  inputMode="numeric"
                  value={companyZip}
                  onChange={(event) => setCompanyZip(event.target.value)}
                  placeholder="10013"
                />
              </Field>
            </div>
          </div>
        )}
      </div>
      )}
      {!readOnly && (
        <div className="space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-neutral-700">{message}</p>}
          <div className="flex flex-wrap gap-3">
            <button
              className={
                saved
                  ? "inline-flex items-center justify-center gap-2 rounded-full bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  : buttonClass
              }
              type="submit"
              disabled={pending || logoPending}
            >
              {pending ? (
                "Saving…"
              ) : saved ? (
                <>
                  <Check className="h-4 w-4" aria-hidden />
                  Saved
                </>
              ) : (
                "Save client"
              )}
            </button>
            {allowDelete && (
              <button
                className="inline-flex items-center justify-center rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={pending || logoPending}
              >
                Delete Client
              </button>
            )}
          </div>
        </div>
      )}
      </div>
      )}
    </form>
    {confirmingDelete && (
      <TypeDeleteDialog
        title={`Delete ${client.name}'s account?`}
        description="Their sign-in will stop working, and their page link will no longer open. This cannot be undone."
        pending={pending}
        onCancel={() => {
          if (!pending) setConfirmingDelete(false);
        }}
        onConfirm={onDelete}
      />
    )}
    </>
  );
}

function StreetNumbers({
  clientId,
  properties,
  assignedIds,
  hiddenIds,
}: {
  clientId: string;
  properties: PropertyListItem[];
  assignedIds: string[];
  hiddenIds: string[];
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState(() => new Set(hiddenIds));
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hiddenKey = hiddenIds.join("|");

  useEffect(() => {
    setHidden(new Set(hiddenKey ? hiddenKey.split("|") : []));
  }, [hiddenKey]);

  const byId = new Map(properties.map((property) => [property.id, property]));
  const residential = assignedIds.flatMap((id) => {
    const property = byId.get(id);
    if (!property || property.listing_type === "commercial") return [];
    if (hideStreetNumber(property.address) === property.address.trim()) return [];
    return [property];
  });
  if (residential.length === 0) return null;

  async function toggle(propertyId: string) {
    const next = !hidden.has(propertyId);
    setPendingId(propertyId);
    setError(null);
    try {
      await sendJson(`/api/clients/${clientId}/street-number`, "PATCH", { propertyId, hidden: next });
      setHidden((current) => {
        const updated = new Set(current);
        if (next) updated.add(propertyId);
        else updated.delete(propertyId);
        return updated;
      });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the street number.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <span className={labelClass}>Street numbers</span>
      <p className="text-xs text-neutral-500">
        Hide the building number on this client&apos;s page, listing, and PDF. The map pin stays.
      </p>
      <ul className="mt-2 space-y-2">
        {residential.map((property) => {
          const isHidden = hidden.has(property.id);
          return (
            <li key={property.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {formatAddress(property.address, property.unit)}
                </span>
                {isHidden && <span className="text-xs text-neutral-500">Hidden on their page</span>}
              </span>
              <button
                type="button"
                className={secondaryButtonClass}
                disabled={pendingId === property.id}
                onClick={() => toggle(property.id)}
              >
                {pendingId === property.id ? "Saving…" : isHidden ? "Show number" : "Hide number"}
              </button>
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function AssignedListings({
  properties,
  assignedIds,
}: {
  properties: PropertyListItem[];
  assignedIds: string[];
}) {
  const byId = new Map(properties.map((property) => [property.id, property]));
  const assigned = assignedIds.flatMap((id) => {
    const property = byId.get(id);
    return property ? [property] : [];
  });
  return (
    <div>
      <span className={labelClass}>Listings on their page</span>
      {assigned.length === 0 ? (
        <p className="text-sm text-neutral-500">None of your shared listings are on this page.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {assigned.map((property) => (
            <li key={property.id}>
              <Link href={`/properties/${property.id}`} className="text-sm font-medium hover:underline">
                {formatAddress(property.address, property.unit)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LikedListings({
  clientId,
  properties,
  likedIds,
  tourIds,
  tourSchedules,
  assignedIds,
  readOnly = false,
  editorId = null,
}: {
  clientId: string;
  properties: PropertyListItem[];
  likedIds: string[];
  tourIds: string[];
  tourSchedules: Record<string, string>;
  assignedIds: string[];
  readOnly?: boolean;
  editorId?: string | null;
}) {
  const byId = new Map(properties.map((property) => [property.id, property]));
  const assigned = new Set(assignedIds);
  const tours = new Set(tourIds);
  const [schedules, setSchedules] = useState(tourSchedules);

  useEffect(() => {
    setSchedules(tourSchedules);
  }, [tourSchedules]);
  const liked = likedIds.flatMap((id) => {
    const property = byId.get(id);
    return property ? [property] : [];
  });
  if (liked.length === 0) return null;
  liked.sort((left, right) => Number(tours.has(right.id)) - Number(tours.has(left.id)));

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <span className={labelClass}>Liked</span>
      <ul className="mt-2 max-h-96 space-y-3 overflow-y-auto">
          {liked.map((property) => (
            <li key={property.id} className="space-y-2">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <Link
                  href={
                    !readOnly && (!editorId || property.created_by === editorId)
                      ? `/admin/properties/${property.id}`
                      : `/properties/${property.id}`
                  }
                  className="min-w-0 truncate text-sm font-medium hover:underline"
                >
                  {formatAddress(property.address, property.unit)}
                </Link>
                <span className="flex shrink-0 items-center gap-2">
                  {tours.has(property.id) && (
                    <span className="rounded-full bg-green-600 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                      {schedules[property.id] ? "Scheduled" : "Tour requested"}
                    </span>
                  )}
                  {assigned.has(property.id) ? null : (
                    <span className="text-xs text-neutral-500">Not on their page</span>
                  )}
                </span>
              </div>
              {tours.has(property.id) && readOnly && schedules[property.id] && (
                <p className="text-xs font-semibold text-green-800">{formatTourWhen(schedules[property.id])}</p>
              )}
              {tours.has(property.id) && !readOnly && (
                <TourScheduleForm
                  clientId={clientId}
                  propertyId={property.id}
                  scheduledAt={schedules[property.id] ?? null}
                  onScheduled={(next) =>
                    setSchedules((current) => {
                      const updated = { ...current };
                      if (next) updated[property.id] = next;
                      else delete updated[property.id];
                      return updated;
                    })
                  }
                />
              )}
            </li>
          ))}
      </ul>
    </div>
  );
}

function TourScheduleForm({
  clientId,
  propertyId,
  scheduledAt,
  onScheduled,
}: {
  clientId: string;
  propertyId: string;
  scheduledAt: string | null;
  onScheduled: (scheduledAt: string | null) => void;
}) {
  const router = useRouter();
  const [date, setDate] = useState(scheduledAt?.slice(0, 10) ?? "");
  const [time, setTime] = useState(scheduledAt?.slice(11, 16) ?? "");
  const [current, setCurrent] = useState(scheduledAt);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const when = date && time ? `${date}T${time.slice(0, 5)}` : "";

  useEffect(() => {
    setDate(scheduledAt?.slice(0, 10) ?? "");
    setTime(scheduledAt?.slice(11, 16) ?? "");
    setCurrent(scheduledAt);
  }, [scheduledAt]);

  async function save(next: string | null) {
    setPending(true);
    setError(null);
    try {
      const saved = await sendJson<{ scheduledAt: string | null }>(`/api/clients/${clientId}/tours`, "PUT", {
        propertyId,
        scheduledAt: next,
      });
      setCurrent(saved.scheduledAt);
      onScheduled(saved.scheduledAt);
      if (!saved.scheduledAt) {
        setDate("");
        setTime("");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not schedule this tour.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2" onKeyDown={(event) => event.key === "Enter" && event.preventDefault()}>
      {current && <p className="text-xs font-semibold text-green-800">{formatTourWhen(current)}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          aria-label="Tour date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="min-w-0 rounded-lg border border-neutral-600 bg-white px-2 py-1.5 text-sm text-black outline-none focus:border-black"
        />
        <input
          type="time"
          aria-label="Tour time"
          value={time}
          onChange={(event) => setTime(event.target.value.slice(0, 5))}
          className="min-w-0 rounded-lg border border-neutral-600 bg-white px-2 py-1.5 text-sm text-black outline-none focus:border-black"
        />
        <button
          type="button"
          className={buttonClass}
          disabled={pending || !when || when === (current ?? "")}
          onClick={() => save(when)}
        >
          {current ? "Update time" : "Mark scheduled"}
        </button>
        {current && (
          <button type="button" className={secondaryButtonClass} disabled={pending} onClick={() => save(null)}>
            Clear
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ListingPicker({
  properties,
  selected,
  likedIds,
  tourIds,
  tourSchedules,
  onToggle,
}: {
  properties: PropertyListItem[];
  selected: string[];
  likedIds: string[];
  tourIds: string[];
  tourSchedules: Record<string, string>;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | ListingType>("all");
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const likedSet = useMemo(() => new Set(likedIds), [likedIds]);
  const tourSet = useMemo(() => new Set(tourIds), [tourIds]);
  const visible = properties.filter((property) => {
    if (kind !== "all" && property.listing_type !== kind) return false;
    const haystack = `${formatAddress(property.address, property.unit)} ${property.neighborhood}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  if (properties.length === 0) {
    return (
      <div>
        <span className={labelClass}>Listings on their page</span>
        <p className="text-sm text-neutral-500">Add a listing before assigning it.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-neutral-50"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>
          <span className={labelClass}>Listings on their page</span>
          <span className="text-sm text-neutral-700">
            {selected.length} of {properties.length} selected
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-neutral-500 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-neutral-200">
          <div className="border-b border-neutral-100 p-3">
            <input
              className={fieldClass}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search address or neighborhood"
              aria-label="Search listings"
            />
          </div>
          {visible.length === 0 ? (
            <p className="px-3 py-6 text-sm text-neutral-500">No listings match.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto overscroll-contain">
              {visible.map((property) => {
                const checked = selectedSet.has(property.id);
                return (
                  <li key={property.id} className="border-b border-neutral-100 last:border-b-0">
                    <label className={`flex min-w-0 flex-wrap items-center gap-2 px-3 py-2.5 sm:gap-3 ${checked ? "bg-neutral-50" : "hover:bg-neutral-50"}`}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 accent-black"
                        checked={checked}
                        onChange={() => onToggle(property.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-black">
                          {formatAddress(property.address, property.unit)}
                        </span>
                        {property.neighborhood && (
                          <span className="block truncate text-xs text-neutral-500">{property.neighborhood}</span>
                        )}
                      </span>
                      {tourSchedules[property.id] ? (
                        <span className="shrink-0 text-right text-[11px] font-semibold uppercase tracking-wide text-green-700">
                          Scheduled
                          <span className="mt-0.5 block font-medium normal-case tracking-normal text-neutral-700">
                            {formatTourWhen(tourSchedules[property.id])}
                          </span>
                        </span>
                      ) : tourSet.has(property.id) ? (
                        <span className="shrink-0 rounded-full bg-green-600 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                          Tour requested
                        </span>
                      ) : likedSet.has(property.id) ? (
                        <span className="shrink-0 rounded-full border border-black px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-black">
                          Liked
                        </span>
                      ) : null}
                      <span className="shrink-0 rounded-full border border-neutral-300 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
                        {listingTypeLabel(property.listing_type)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-1.5 border-t border-neutral-100 px-3 py-2.5">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Show</span>
            {(
              [
                ["all", "All"],
                ["rental", "Rentals"],
                ["sale", "Sales"],
                ["commercial", "Commercial"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={kind === id}
                onClick={() => setKind(id)}
                className={
                  kind === id
                    ? "rounded-full bg-black px-2.5 py-1 text-xs font-medium text-white"
                    : "rounded-full border border-neutral-300 px-2.5 py-1 text-xs font-medium text-black hover:border-black"
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
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

function ClientLink({ token }: { token: string | null }) {
  const [href, setHref] = useState(token ? `/c/${token}` : "");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) return;
    setHref(`${window.location.origin}/c/${token}`);
  }, [token]);

  async function copy() {
    if (!href) return;
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (!token) return null;

  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-2">
      <a
        className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-black px-2.5 py-1 text-xs font-medium text-white hover:bg-neutral-800"
        href={`/c/${token}`}
        target="_blank"
        rel="noreferrer"
      >
        Open Client Page
      </a>
      <button
        className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-black px-2.5 py-1 text-xs font-medium text-white hover:bg-neutral-800"
        type="button"
        onClick={copy}
      >
        {copied ? "Copied" : "Copy Link"}
      </button>
    </div>
  );
}

async function uploadLogoFile(clientId: string, file: File) {
  const body = new FormData();
  body.set("file", file);
  const response = await fetch(`/api/clients/${clientId}/logo`, { method: "POST", body });
  const data = (await response.json().catch(() => ({}))) as { error?: string; logoKey?: string };
  if (!response.ok || !data.logoKey) throw new Error(data.error || "Could not upload that logo.");
  return { logoKey: data.logoKey };
}
