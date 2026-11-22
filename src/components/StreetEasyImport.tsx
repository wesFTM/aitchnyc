"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, fieldClass, labelClass } from "@/lib/styles";

export function StreetEasyImport() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/properties/import/streeteasy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        id?: string;
        geocoded?: boolean;
        imageCount?: number;
      };
      if (!response.ok || !data.id) throw new Error(data.error || "Could not create that listing.");
      const placed = data.geocoded ? "" : "&placed=0";
      const photos = data.imageCount ? "" : "&photos=0";
      router.push(`/admin/properties/${data.id}?imported=1${placed}${photos}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create that listing.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-neutral-200 p-5">
      <h2 className="text-lg font-semibold">Create from StreetEasy</h2>
      <p className="mt-1 mb-4 text-sm text-neutral-500">
        Paste a rental link. Monthly rent, address, unit, neighborhood, size, beds, baths, amenities, description, and
        photos are filled in from the listing. Anything it doesn&apos;t include stays blank for you to add on the next
        screen.
      </p>
      <label className="block">
        <span className={labelClass}>StreetEasy link</span>
        <input
          className={fieldClass}
          type="url"
          inputMode="url"
          placeholder="https://streeteasy.com/building/..."
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          required
        />
      </label>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <button className={`${buttonClass} mt-4`} type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create listing"}
      </button>
    </form>
  );
}
