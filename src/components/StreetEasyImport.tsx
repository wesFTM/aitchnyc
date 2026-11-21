"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, fieldClass, labelClass } from "@/lib/styles";

const LIVE_HOSTS = new Set(["h-nyc.com", "www.h-nyc.com"]);
const LOCAL_READER = "http://127.0.0.1:3000/api/properties/import/streeteasy/read";
const PHOTO_URL = /^https:\/\/photos\.zillowstatic\.com\/fp\/[a-f0-9]{16,64}-se_large_800_400\.jpg$/i;

type StreetEasyFields = {
  address: string;
  unit: string;
  price: string;
  neighborhood: string;
  sqft: string;
  bedrooms: string;
  bathrooms: string;
  description: string;
  status: string;
  amenities: Record<string, boolean>;
  photoUrls: string[];
};

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

async function downloadPhotos(urls: string[]) {
  const images: string[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < urls.length) {
      const index = cursor;
      cursor += 1;
      try {
        const response = await fetch(urls[index]);
        if (!response.ok) continue;
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength === 0 || bytes.byteLength > 2_000_000) continue;
        images[index] = toBase64(bytes);
      } catch {
        continue;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, urls.length) }, () => worker()));
  return images.filter((image): image is string => Boolean(image));
}

async function readOnThisComputer(url: string): Promise<StreetEasyFields> {
  let response: Response;
  try {
    response = await fetch(LOCAL_READER, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    });
  } catch {
    throw new Error("Start the local site on this computer, then try the StreetEasy link again.");
  }
  const data = (await response.json().catch(() => ({}))) as StreetEasyFields & { error?: string };
  if (!response.ok) throw new Error(data.error || "Couldn't read that StreetEasy listing.");
  return data;
}

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
      const live = LIVE_HOSTS.has(window.location.hostname);
      const fields = live ? await readOnThisComputer(url) : null;
      const images = fields ? await downloadPhotos(fields.photoUrls.filter((item) => PHOTO_URL.test(item))) : undefined;
      const response = await fetch("/api/properties/import/streeteasy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(fields ? { draft: fields, images } : { url }),
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
