"use client";

/* Logos are user uploads, so skip the image optimizer. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { TypeDeleteDialog } from "@/components/TypeDeleteDialog";
import { sendJson } from "@/lib/client-api";
import { clientLogoUrl } from "@/lib/client-logo";
import { formatAddress, listingTypeLabel } from "@/lib/format";
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
      setNotice(logoNote ? `Client added. ${logoNote}` : "Client added.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add that client.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full min-w-0 max-w-full space-y-4 overflow-x-clip rounded-2xl border border-neutral-800 p-4">
      <div>
        <span className={labelClass}>Company logo</span>
        <input
          key={fileKey}
          className="block w-full min-w-0 max-w-full text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border file:border-neutral-600 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-black hover:file:border-black"
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
      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-neutral-700">{notice}</p>}
    </form>
  );
}

export function ClientCard({
  client,
  properties,
  assignedIds,
  likedIds,
  tourIds,
}: {
  client: User;
  properties: PropertyListItem[];
  assignedIds: string[];
  likedIds: string[];
  tourIds: string[];
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

  useEffect(() => {
    setLogoKey(client.logo_key);
  }, [client.logo_key]);

  const preview = clientLogoUrl(client.share_token, logoKey);
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
    <form onSubmit={onSave} className="w-full min-w-0 max-w-full space-y-4 overflow-x-clip rounded-2xl border border-neutral-800 p-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-neutral-800 bg-neutral-50">
          {preview ? (
            <img src={preview} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="px-1 text-center text-[10px] font-medium uppercase tracking-wide text-neutral-400">No logo</span>
          )}
        </div>
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
          <p className="text-xs text-neutral-500">Shown beside “Your listings” on their page. Logo changes save right away.</p>
        </div>
      </div>
      <LikedListings properties={properties} likedIds={likedIds} tourIds={tourIds} assignedIds={assignedIds} />
      <ListingPicker
        properties={properties}
        selected={selected}
        likedIds={likedIds}
        tourIds={tourIds}
        onToggle={(id) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))}
      />
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
      <ClientLink token={client.share_token} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-neutral-700">{message}</p>}
      <div className="flex flex-wrap gap-3">
        <button
          className={
            saved
              ? "inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
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
        <button
          className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          type="button"
          onClick={() => setConfirmingDelete(true)}
          disabled={pending || logoPending}
        >
          Delete Client
        </button>
      </div>
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

function LikedListings({
  properties,
  likedIds,
  tourIds,
  assignedIds,
}: {
  properties: PropertyListItem[];
  likedIds: string[];
  tourIds: string[];
  assignedIds: string[];
}) {
  const byId = new Map(properties.map((property) => [property.id, property]));
  const assigned = new Set(assignedIds);
  const tours = new Set(tourIds);
  const liked = likedIds.flatMap((id) => {
    const property = byId.get(id);
    return property ? [property] : [];
  });
  if (liked.length === 0) return null;
  liked.sort((left, right) => Number(tours.has(right.id)) - Number(tours.has(left.id)));

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <span className={labelClass}>Liked</span>
      <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
          {liked.map((property) => (
            <li key={property.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <Link
                href={`/admin/properties/${property.id}`}
                className="min-w-0 truncate text-sm font-medium hover:underline"
              >
                {formatAddress(property.address, property.unit)}
              </Link>
              <span className="flex shrink-0 items-center gap-2">
                {tours.has(property.id) && (
                  <span className="rounded-full bg-green-600 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                    Tour requested
                  </span>
                )}
                {assigned.has(property.id) ? null : (
                  <span className="text-xs text-neutral-500">Not on their page</span>
                )}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}

function ListingPicker({
  properties,
  selected,
  likedIds,
  tourIds,
  onToggle,
}: {
  properties: PropertyListItem[];
  selected: string[];
  likedIds: string[];
  tourIds: string[];
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
                      {tourSet.has(property.id) ? (
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
    <div className="space-y-2">
      <span className={labelClass}>Page link</span>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className={fieldClass} readOnly value={href} onFocus={(event) => event.currentTarget.select()} />
        <button className={secondaryButtonClass} type="button" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
        <a className={secondaryButtonClass} href={`/c/${token}`} target="_blank" rel="noreferrer">
          Open
        </a>
      </div>
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
