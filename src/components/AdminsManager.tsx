"use client";

/* Profile photos are authenticated uploads, so skip the image optimizer. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { TypeDeleteDialog } from "@/components/TypeDeleteDialog";
import { sendJson } from "@/lib/client-api";
import { formatAddress, listingTypeLabel } from "@/lib/format";
import { buttonClass, fieldClass, labelClass, secondaryButtonClass } from "@/lib/styles";
import type { ListingType } from "@/lib/types";

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export type AdminRecord = {
  id: string;
  email: string;
  name: string;
  signedInAt: string | null;
  avatarKey: string | null;
  propertyIds: string[];
  clientIds: string[];
};

export type ListingChoice = {
  id: string;
  address: string;
  unit: string | null;
  neighborhood: string;
  listingType: ListingType;
};

export type ClientChoice = {
  id: string;
  name: string;
  email: string;
};

export function NewAdminForm({ listings, clients }: { listings: ListingChoice[]; clients: ClientChoice[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [propertyIds, setPropertyIds] = useState<string[]>([]);
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!photo) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const created = await sendJson<{ id: string }>("/api/admins", "POST", { email, name, propertyIds, clientIds });
      if (photo) await uploadAdminPhoto(created.id, photo);
      setEmail("");
      setName("");
      setPhoto(null);
      setPropertyIds([]);
      setClientIds([]);
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add that admin.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full min-w-0 overflow-hidden rounded-2xl border border-neutral-800">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex min-w-0 items-center gap-3">
          <AdminAvatar name={name || "Admin"} email={email} previewUrl={previewUrl} />
          <span className="text-lg font-semibold">Add an admin</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-neutral-500 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div className="space-y-4 border-t border-neutral-800 p-4">
          <p className="text-sm text-neutral-500">
            Use the Google email they will sign in with. Their account opens the first time that email signs in, and they only see the listings and clients you check here.
          </p>
          <AdminPhotoPicker previewUrl={previewUrl} name={name} email={email} onFile={setPhoto} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Google email</span>
              <input
                className={fieldClass}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@company.com"
                required
              />
            </label>
            <label className="block">
              <span className={labelClass}>Name</span>
              <input
                className={fieldClass}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Optional until they sign in"
              />
            </label>
          </div>
          <AccessPicker
            listings={listings}
            clients={clients}
            propertyIds={propertyIds}
            clientIds={clientIds}
            onProperties={setPropertyIds}
            onClients={setClientIds}
          />
          <button className={buttonClass} type="submit" disabled={pending}>
            {pending ? "Adding…" : "Add admin"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </form>
  );
}

export function AdminCard({
  admin,
  listings,
  clients,
}: {
  admin: AdminRecord;
  listings: ListingChoice[];
  clients: ClientChoice[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(admin.email);
  const [name, setName] = useState(admin.name);
  const [avatarKey, setAvatarKey] = useState(admin.avatarKey);
  const [propertyIds, setPropertyIds] = useState(admin.propertyIds);
  const [clientIds, setClientIds] = useState(admin.clientIds);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    setAvatarKey(admin.avatarKey);
  }, [admin.avatarKey]);

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await sendJson(`/api/admins/${admin.id}`, "PATCH", { email, name, propertyIds, clientIds });
      if (!name.trim()) setName(email.split("@")[0] || "Admin");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this admin.");
    } finally {
      setPending(false);
    }
  }

  async function onDelete() {
    setPending(true);
    setError(null);
    try {
      await sendJson(`/api/admins/${admin.id}`, "DELETE");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove this admin.");
      setPending(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <>
      <form onSubmit={onSave} className="overflow-hidden rounded-2xl border border-neutral-800">
        <AdminSummary
          id={admin.id}
          name={name.trim() || email}
          email={email}
          avatarKey={avatarKey}
          detail={`${countLabel(admin.clientIds.length, "client")} · ${countLabel(admin.propertyIds.length, "listing")}`}
          open={open}
          onToggle={() => setOpen((current) => !current)}
        />
        {open && (
        <div className="space-y-4 border-t border-neutral-800 p-4">
        <p className="text-sm text-neutral-500">{signInLabel(admin.signedInAt)}</p>
        <AdminPhotoEditor id={admin.id} avatarKey={avatarKey} onChange={setAvatarKey} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Google email</span>
            <input
              className={fieldClass}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className={labelClass}>Name</span>
            <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} />
          </label>
        </div>
        <AccessPicker
          listings={listings}
          clients={clients}
          propertyIds={propertyIds}
          clientIds={clientIds}
          onProperties={setPropertyIds}
          onClients={setClientIds}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <button className={buttonClass} type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save admin"}
          </button>
          <button
            className="inline-flex items-center justify-center rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            type="button"
            onClick={() => setConfirmingDelete(true)}
            disabled={pending}
          >
            Remove admin
          </button>
        </div>
        </div>
        )}
      </form>
      {confirmingDelete && (
        <TypeDeleteDialog
          title={`Remove ${name.trim() || email}?`}
          description="They will lose this dashboard the next time they try to sign in. This does not delete listings or clients."
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

function AccessPicker({
  listings,
  clients,
  propertyIds,
  clientIds,
  onProperties,
  onClients,
}: {
  listings: ListingChoice[];
  clients: ClientChoice[];
  propertyIds: string[];
  clientIds: string[];
  onProperties: (ids: string[]) => void;
  onClients: (ids: string[]) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChoiceList
        label="Listings they can see"
        empty="No listings yet."
        queryLabel="Search listings"
        options={listings.map((listing) => ({
          id: listing.id,
          title: formatAddress(listing.address, listing.unit),
          detail: [listing.neighborhood, listingTypeLabel(listing.listingType)].filter(Boolean).join(" · "),
        }))}
        selected={propertyIds}
        onChange={onProperties}
      />
      <ChoiceList
        label="Clients they can see"
        empty="No clients yet."
        queryLabel="Search clients"
        options={clients.map((client) => ({
          id: client.id,
          title: client.name,
          detail: client.email,
        }))}
        selected={clientIds}
        onChange={onClients}
      />
    </div>
  );
}

function ChoiceList({
  label,
  empty,
  queryLabel,
  options,
  selected,
  onChange,
}: {
  label: string;
  empty: string;
  queryLabel: string;
  options: { id: string; title: string; detail: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const visible = options.filter((option) => {
    const haystack = `${option.title} ${option.detail}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  function toggle(id: string) {
    onChange(selectedSet.has(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200">
      <div className="border-b border-neutral-100 px-3 py-3">
        <span className={labelClass}>{label}</span>
        <p className="text-sm text-neutral-700">
          {selected.length} of {options.length} selected
        </p>
      </div>
      {options.length === 0 ? (
        <p className="px-3 py-4 text-sm text-neutral-500">{empty}</p>
      ) : (
        <>
          <div className="border-b border-neutral-100 p-3">
            <input
              className={fieldClass}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={queryLabel}
              aria-label={queryLabel}
            />
          </div>
          {visible.length === 0 ? (
            <p className="px-3 py-6 text-sm text-neutral-500">No matches.</p>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {visible.map((option) => {
                const checked = selectedSet.has(option.id);
                return (
                  <li key={option.id} className="border-b border-neutral-100 last:border-b-0">
                    <label className={`flex min-w-0 items-center gap-3 px-3 py-2.5 ${checked ? "bg-neutral-50" : ""}`}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 accent-black"
                        checked={checked}
                        onChange={() => toggle(option.id)}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{option.title}</span>
                        {option.detail && <span className="block truncate text-xs text-neutral-500">{option.detail}</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function signInLabel(value: string | null) {
  if (!value) return "Waiting for this Google account to sign in.";
  const date = new Date(`${value.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return "Signed in with Google.";
  return `Signed in with Google · ${date.toLocaleString()}`;
}

export function AdminRoster({ admins, clients }: { admins: AdminRecord[]; clients: ClientChoice[] }) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Admins</h2>
          <p className="mt-1 max-w-2xl text-sm text-neutral-500">
            Each count is the clients and listings on that admin&apos;s list, including ones they added. Assign clients from the master list here. Listing access is on the Admins page.
          </p>
        </div>
        <Link href="/admin/admins" className="text-sm font-semibold underline">
          Manage listing access
        </Link>
      </div>
      {admins.length === 0 ? (
        <p className="text-sm text-neutral-500">No admins yet. Add one from the Admins page.</p>
      ) : (
        <div className="grid gap-4">
          {admins.map((admin) => (
            <AdminRosterCard key={admin.id} admin={admin} clients={clients} />
          ))}
        </div>
      )}
    </section>
  );
}

function AdminRosterCard({ admin, clients }: { admin: AdminRecord; clients: ClientChoice[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(admin.email);
  const [name, setName] = useState(admin.name);
  const [avatarKey, setAvatarKey] = useState(admin.avatarKey);
  const [clientIds, setClientIds] = useState(admin.clientIds);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setAvatarKey(admin.avatarKey);
  }, [admin.avatarKey]);

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await sendJson(`/api/admins/${admin.id}`, "PATCH", {
        email,
        name,
        propertyIds: admin.propertyIds,
        clientIds,
      });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this admin.");
    } finally {
      setPending(false);
    }
  }

  function toggleClient(id: string) {
    setClientIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <form onSubmit={onSave} className="overflow-hidden rounded-2xl border border-neutral-800">
      <AdminSummary
        id={admin.id}
        name={name.trim() || email}
        email={email}
        avatarKey={avatarKey}
        detail={`${countLabel(admin.clientIds.length, "client")} · ${countLabel(admin.propertyIds.length, "listing")} · ${signInLabel(admin.signedInAt)}`}
        open={open}
        onToggle={() => setOpen((current) => !current)}
      />
      {open && (
      <div className="space-y-4 border-t border-neutral-800 p-4">
      <AdminPhotoEditor id={admin.id} avatarKey={avatarKey} onChange={setAvatarKey} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Google email</span>
          <input className={fieldClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="block">
          <span className={labelClass}>Name</span>
          <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
      </div>
      <div className="space-y-2">
        <p className={labelClass}>Clients from the master list</p>
        {clients.length === 0 ? (
          <p className="text-sm text-neutral-500">No clients on the master list yet.</p>
        ) : (
          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-neutral-200 p-2">
            {clients.map((client) => (
              <li key={client.id}>
                <label className="flex items-center gap-2 px-1 py-1 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-black"
                    checked={clientIds.includes(client.id)}
                    onChange={() => toggleClient(client.id)}
                  />
                  <span className="min-w-0 truncate">{client.name}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className={buttonClass} type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save admin"}
      </button>
      </div>
      )}
    </form>
  );
}

export function AdminAvatar({
  name,
  email,
  id,
  avatarKey,
  previewUrl,
  size = 48,
}: {
  name: string;
  email: string;
  id?: string;
  avatarKey?: string | null;
  previewUrl?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [avatarKey, previewUrl]);
  const src = previewUrl || (id && avatarKey && !failed ? `/api/admins/${id}/avatar?v=${encodeURIComponent(avatarKey)}` : null);
  const letter = firstInitial(name, email);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-base font-semibold text-black"
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        letter
      )}
    </span>
  );
}

function AdminSummary({
  id,
  name,
  email,
  avatarKey,
  detail,
  open,
  onToggle,
}: {
  id: string;
  name: string;
  email: string;
  avatarKey: string | null;
  detail: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <AdminAvatar id={id} name={name} email={email} avatarKey={avatarKey} />
      <button type="button" className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left" aria-expanded={open} onClick={onToggle}>
        <span className="min-w-0">
          <span className="block truncate text-lg font-semibold">{name}</span>
          <span className="block truncate text-sm text-neutral-500">{detail}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-neutral-500 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      <Link href={`/admin/admins/${id}`} className="shrink-0 text-sm font-semibold underline">
        View page
      </Link>
    </div>
  );
}

function AdminPhotoPicker({
  name,
  email,
  previewUrl,
  onFile,
}: {
  name: string;
  email: string;
  previewUrl: string | null;
  onFile: (file: File | null) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <AdminAvatar name={name || "Admin"} email={email} previewUrl={previewUrl} size={72} />
      <label className="min-w-0 flex-1">
        <span className={labelClass}>Profile photo</span>
        <input
          className="block w-full min-w-0 text-sm text-neutral-600 file:mr-3 file:rounded-full file:border file:border-neutral-600 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-black hover:file:border-black"
          type="file"
          accept={PHOTO_TYPES.join(",")}
          onChange={(event) => onFile(event.target.files?.[0] ?? null)}
        />
        <p className="mt-1 text-xs text-neutral-500">Optional. Without a photo, the avatar uses the first letter of their name.</p>
      </label>
    </div>
  );
}

function AdminPhotoEditor({
  id,
  avatarKey,
  onChange,
}: {
  id: string;
  avatarKey: string | null;
  onChange: (key: string | null) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | null) {
    if (!file) return;
    setPending(true);
    setError(null);
    try {
      onChange(await uploadAdminPhoto(id, file));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not upload that photo.");
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    setPending(true);
    setError(null);
    try {
      await sendJson(`/api/admins/${id}/avatar`, "DELETE");
      onChange(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove that photo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="block">
        <span className={labelClass}>Profile photo</span>
        <input
          className="block w-full min-w-0 text-sm text-neutral-600 file:mr-3 file:rounded-full file:border file:border-neutral-600 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-black hover:file:border-black"
          type="file"
          accept={PHOTO_TYPES.join(",")}
          disabled={pending}
          onChange={(event) => onFile(event.target.files?.[0] ?? null)}
        />
      </label>
      {avatarKey && (
        <button className={secondaryButtonClass} type="button" onClick={remove} disabled={pending}>
          Remove photo
        </button>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function firstInitial(name: string, email: string) {
  const source = (name.trim() || email.trim() || "A").split(/\s+/)[0] || "A";
  return source.slice(0, 1).toUpperCase();
}

function countLabel(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

async function uploadAdminPhoto(id: string, file: File) {
  const body = new FormData();
  body.set("file", file);
  const response = await fetch(`/api/admins/${id}/avatar`, { method: "POST", body });
  const data = (await response.json().catch(() => ({}))) as { error?: string; avatarKey?: string };
  if (!response.ok || !data.avatarKey) throw new Error(data.error || "Could not upload that photo.");
  return data.avatarKey;
}
