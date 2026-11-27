"use client";

import { useState } from "react";
import { useI18n } from "@/components/LanguageProvider";
import { sendJson } from "@/lib/client-api";

export function RequestTourButton({
  propertyId,
  name,
  requested,
  endpoint,
  block = false,
  onChange,
}: {
  propertyId: string;
  name: string;
  requested: boolean;
  endpoint: string;
  block?: boolean;
  onChange?: (requested: boolean) => void;
}) {
  const { t } = useI18n();
  const [on, setOn] = useState(requested);
  const [pending, setPending] = useState(false);
  const label = on ? t("listings.tourRequestedFor", { name }) : t("listings.requestTourOf", { name });

  async function toggle() {
    if (pending) return;
    const next = !on;
    setOn(next);
    setPending(true);
    try {
      await sendJson(endpoint, "PUT", { propertyId, requested: next });
      onChange?.(next);
    } catch {
      setOn(!next);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      disabled={pending}
      onClick={toggle}
      className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
        block ? "w-full" : ""
      } ${on ? "border-green-600 bg-green-600 text-white" : "border-neutral-300 bg-white text-black hover:border-black"}`}
    >
      {on ? t("listings.tourRequested") : t("listings.requestTour")}
    </button>
  );
}
