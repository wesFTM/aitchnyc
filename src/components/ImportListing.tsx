"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/LanguageProvider";
import { readFlyer } from "@/lib/flyer-client";
import { buttonClass, fieldClass, labelClass, secondaryButtonClass } from "@/lib/styles";

export function ImportListing() {
  const router = useRouter();
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"link" | "file" | null>(null);

  function openListing(result: { id: string; geocoded: boolean }) {
    const placed = result.geocoded ? "" : "&placed=0";
    router.push(`/admin/properties/${result.id}?imported=1${placed}`);
    router.refresh();
  }

  async function saveFlyer(bytes: Uint8Array, sourceName: string) {
    const flyer = await readFlyer(bytes, sourceName);
    const body = new FormData();
    body.set("draft", JSON.stringify(flyer.draft));
    flyer.images.forEach((image, index) => {
      body.append("image", image, `photo-${index + 1}.jpg`);
    });
    const response = await fetch("/api/properties/import", { method: "POST", body });
    if (response.status === 503) throw new Error(t("import.retry"));
    const data = (await response.json().catch(() => ({}))) as { error?: string; id?: string; geocoded?: boolean };
    if (!response.ok || !data.id) throw new Error(data.error || t("import.failed"));
    openListing({ id: data.id, geocoded: Boolean(data.geocoded) });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending("link");
    setError(null);
    try {
      const response = await fetch("/api/properties/import/source", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const type = response.headers.get("content-type") || "";
      if (!response.ok || !type.includes("pdf")) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || t("import.downloadFailed"));
      }
      await saveFlyer(new Uint8Array(await response.arrayBuffer()), url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("import.failed"));
      setPending(null);
    }
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || pending) return;
    const pdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!pdf) {
      setError(t("import.choosePdf"));
      return;
    }
    setPending("file");
    setError(null);
    try {
      await saveFlyer(new Uint8Array(await file.arrayBuffer()), file.name);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("import.failed"));
      setPending(null);
    }
  }

  return (
    <form onSubmit={onSubmit} className="h-full w-full min-w-0 max-w-full rounded-2xl border border-neutral-200 p-5">
      <h2 className="mb-4 text-lg font-semibold">{t("import.pdf")}</h2>
      <label className="block">
        <span className={labelClass}>{t("import.link")}</span>
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
          {pending === "link" ? t("import.importing") : t("import.create")}
        </button>
        <button
          className={secondaryButtonClass}
          type="button"
          disabled={pending !== null}
          onClick={() => fileRef.current?.click()}
        >
          {pending === "file" ? t("import.uploading") : t("import.uploadPdf")}
        </button>
      </div>
      <input ref={fileRef} className="hidden" type="file" accept="application/pdf,.pdf" onChange={onFile} />
    </form>
  );
}
