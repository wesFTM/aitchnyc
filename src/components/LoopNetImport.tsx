"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/LanguageProvider";
import { buttonClass, fieldClass, labelClass } from "@/lib/styles";

export function LoopNetImport() {
  const router = useRouter();
  const { t } = useI18n();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/properties/import/loopnet", {
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
      if (!response.ok || !data.id) throw new Error(data.error || t("import.createFailed"));
      const placed = data.geocoded ? "" : "&placed=0";
      const photos = data.imageCount ? "" : "&photos=0";
      router.push(`/admin/properties/${data.id}?imported=1${placed}${photos}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("import.createFailed"));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="h-full w-full min-w-0 max-w-full rounded-2xl border border-neutral-200 p-5">
      <h2 className="mb-4 text-lg font-semibold">{t("import.loopnet")}</h2>
      <label className="block">
        <span className={labelClass}>{t("import.loopnetLink")}</span>
        <input
          className={fieldClass}
          type="url"
          inputMode="url"
          placeholder="https://www.loopnet.com/Listing/..."
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          required
        />
      </label>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <button className={`${buttonClass} mt-4`} type="submit" disabled={pending}>
        {pending ? t("import.creating") : t("import.create")}
      </button>
    </form>
  );
}
