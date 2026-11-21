"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sendJson } from "@/lib/client-api";
import { buttonClass, fieldClass, labelClass, secondaryButtonClass } from "@/lib/styles";

export function ImportListing() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"link" | "file" | null>(null);

  function openListing(result: { id: string; geocoded: boolean }) {
    const placed = result.geocoded ? "" : "&placed=0";
    router.push(`/admin/properties/${result.id}?imported=1${placed}`);
    router.refresh();
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending("link");
    setError(null);
    try {
      const result = await sendJson<{ id: string; geocoded: boolean }>("/api/properties/import", "POST", { url });
      openListing(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not import that listing.");
      setPending(null);
    }
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || pending) return;
    const pdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!pdf) {
      setError("Choose a PDF flyer.");
      return;
    }
    setPending("file");
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/properties/import", { method: "POST", body });
      const data = (await response.json().catch(() => ({}))) as { error?: string; id?: string; geocoded?: boolean };
      if (!response.ok || !data.id) throw new Error(data.error || "Could not import that listing.");
      openListing({ id: data.id, geocoded: Boolean(data.geocoded) });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not import that listing.");
      setPending(null);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-neutral-200 p-5">
      <h2 className="text-lg font-semibold">Import a flyer</h2>
      <p className="mt-1 mb-4 text-sm text-neutral-500">
        Paste a link or upload the PDF. Address, rent, size, and photos are filled in from the file. Anything the file
        doesn't include stays blank for you to add on the next screen.
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
      <div className="mt-4 flex flex-wrap gap-2">
        <button className={buttonClass} type="submit" disabled={pending !== null}>
          {pending === "link" ? "Importing…" : "Create listing from link"}
        </button>
        <button
          className={secondaryButtonClass}
          type="button"
          disabled={pending !== null}
          onClick={() => fileRef.current?.click()}
        >
          {pending === "file" ? "Uploading…" : "Upload a PDF"}
        </button>
      </div>
      <input ref={fileRef} className="hidden" type="file" accept="application/pdf,.pdf" onChange={onFile} />
    </form>
  );
}
