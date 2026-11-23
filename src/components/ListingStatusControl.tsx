"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sendJson } from "@/lib/client-api";
import { LISTING_STATUSES, statusLabel, statusTone } from "@/lib/format";
import type { ListingStatus } from "@/lib/types";

export function ListingStatusBadge({
  status,
  className = "",
}: {
  status: ListingStatus;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusTone(status)} ${className}`}
    >
      {statusLabel(status)}
    </span>
  );
}

export function ListingStatusControl({
  propertyId,
  status,
  onChange,
  size = "sm",
}: {
  propertyId?: string;
  status: ListingStatus;
  onChange?: (status: ListingStatus) => void;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrent(status);
  }, [status]);

  async function choose(next: ListingStatus) {
    if (next === current || pending) return;
    const previous = current;
    setCurrent(next);
    onChange?.(next);
    if (!propertyId) return;
    setPending(true);
    setError(null);
    try {
      await sendJson(`/api/properties/${propertyId}/status`, "PATCH", { status: next });
      router.refresh();
    } catch (caught) {
      setCurrent(previous);
      onChange?.(previous);
      setError(caught instanceof Error ? caught.message : "Could not update the status.");
    } finally {
      setPending(false);
    }
  }

  const buttonClass =
    size === "md"
      ? "rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide disabled:opacity-50"
      : "rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide disabled:opacity-50";

  return (
    <div className="min-w-0 max-w-full space-y-1">
      <div className="flex max-w-full flex-wrap gap-1.5" role="group" aria-label="Listing status">
        {LISTING_STATUSES.map((option) => {
          const selected = option === current;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              disabled={pending}
              onClick={() => void choose(option)}
              className={`${buttonClass} ${
                selected ? statusTone(option) : "border-neutral-300 bg-white text-neutral-600 hover:border-black hover:text-black"
              }`}
            >
              {statusLabel(option)}
            </button>
          );
        })}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
