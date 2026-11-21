"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendJson } from "@/lib/client-api";
import { buttonClass, fieldClass, labelClass } from "@/lib/styles";

export function ImportListing() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await sendJson<{ id: string; geocoded: boolean }>("/api/properties/import", "POST", { url });
      const placed = result.geocoded ? "" : "&placed=0";
      router.push(`/admin/properties/${result.id}?imported=1${placed}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not import that listing.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-neutral-200 p-5">
      <h2 className="text-lg font-semibold">Import from a link</h2>
      <p className="mt-1 mb-4 text-sm text-neutral-500">
        Paste a link to a listing flyer. Address, rent, size, and photos are filled in from the file. Anything the
        file doesn't include stays blank for you to add on the next screen.
      </p>
      <label className="block">
        <span className={labelClass}>Listing link</span>
        <input
          className={fieldClass}
          type="url"
          inputMode="url"
          placeholder="https://example.com/listing.pdf"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          required
        />
      </label>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <button className={`${buttonClass} mt-4`} type="submit" disabled={pending}>
        {pending ? "Importing…" : "Create listing from link"}
      </button>
    </form>
  );
}
