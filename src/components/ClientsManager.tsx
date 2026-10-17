"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendJson } from "@/lib/client-api";
import { formatAddress } from "@/lib/format";
import { buttonClass, fieldClass, labelClass, secondaryButtonClass } from "@/lib/styles";
import type { PropertyListItem, User } from "@/lib/types";

export function NewClientForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await sendJson("/api/clients", "POST", { name, email });
      setName("");
      setEmail("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add that client.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 rounded-2xl border border-neutral-200 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label>
        <span className={labelClass}>Name</span>
        <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <label>
        <span className={labelClass}>Gmail</span>
        <input
          className={fieldClass}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="client@gmail.com"
          required
        />
      </label>
      <button className={buttonClass} type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add client"}
      </button>
      {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}
    </form>
  );
}

export function ClientCard({
  client,
  properties,
  assignedIds,
}: {
  client: User;
  properties: PropertyListItem[];
  assignedIds: string[];
}) {
  const router = useRouter();
  const [name, setName] = useState(client.name);
  const [email, setEmail] = useState(client.email);
  const [selected, setSelected] = useState<string[]>(assignedIds);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await sendJson(`/api/clients/${client.id}`, "PATCH", { name, email });
      await sendJson(`/api/clients/${client.id}/assignments`, "PUT", { propertyIds: selected });
      setMessage("Saved.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this client.");
    } finally {
      setPending(false);
    }
  }

  async function onDelete() {
    if (!window.confirm(`Remove ${client.name}? Their sign-in will stop working.`)) return;
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

  return (
    <form onSubmit={onSave} className="space-y-4 rounded-2xl border border-neutral-200 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className={labelClass}>Name</span>
          <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          <span className={labelClass}>Gmail</span>
          <input className={fieldClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
      </div>
      <fieldset>
        <legend className={labelClass}>Listings on their page</legend>
        {properties.length === 0 ? (
          <p className="text-sm text-neutral-500">Add a listing before assigning it.</p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-auto pr-1">
            {properties.map((property) => (
              <li key={property.id}>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-black"
                    checked={selected.includes(property.id)}
                    onChange={() => toggle(property.id)}
                  />
                  <span>{formatAddress(property.address, property.unit)}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-neutral-700">{message}</p>}
      <div className="flex gap-3">
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save client"}
        </button>
        <button className={secondaryButtonClass} type="button" onClick={onDelete} disabled={pending}>
          Remove
        </button>
      </div>
    </form>
  );
}
