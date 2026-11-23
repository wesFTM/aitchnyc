"use client";

/* Authenticated media can't go through the image optimizer. */
/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ListingStatusBadge, ListingStatusControl } from "@/components/ListingStatusControl";
import { displayStatus, formatAddress, formatFacts, formatPrice, listingTypeLabel } from "@/lib/format";
import type { ListingStatus, PropertyListItem } from "@/lib/types";

export function ListingCard({
  property,
  href,
  coverSrc,
  like,
  footer,
  editableStatus = false,
}: {
  property: PropertyListItem;
  href: string;
  coverSrc?: string | null;
  like?: ReactNode;
  footer?: ReactNode;
  editableStatus?: boolean;
}) {
  const image = coverSrc === undefined ? (property.cover_id ? `/api/media/${property.cover_id}` : null) : coverSrc;
  const incomingStatus = displayStatus(property);
  const [status, setStatus] = useState<ListingStatus>(incomingStatus);
  useEffect(() => {
    setStatus(incomingStatus);
  }, [incomingStatus]);
  return (
    <div className="relative w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <Link href={href} className="group block min-w-0 text-black">
      <div className="relative aspect-[4/3] bg-neutral-100">
        {image ? (
          <img
            src={image}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-neutral-400">No photo</div>
        )}
        <div className="pointer-events-none absolute top-3 left-3 z-10">
          <ListingStatusBadge status={status} className="shadow-sm" />
        </div>
      </div>
      <div className="space-y-2 p-4">
        <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
          <span className="rounded-full border border-black px-2 py-0.5">{listingTypeLabel(property.listing_type)}</span>
        </div>
        <h2 className="break-words text-base font-semibold leading-snug group-hover:underline">
          {formatAddress(property.address, property.unit)}
        </h2>
        <p className="break-words text-sm text-neutral-600">
          {[property.neighborhood, formatPrice(property.price_cents, property.listing_type)].filter(Boolean).join(" · ")}
        </p>
        <p className="break-words text-sm text-neutral-500">{formatFacts(property) || "Details coming"}</p>
        {property.lat == null && <p className="text-xs text-amber-700">Not on the map yet</p>}
      </div>
      </Link>
      {like && <div className="absolute top-3 right-3 z-10">{like}</div>}
      {(editableStatus || footer) && (
        <div className="space-y-3 border-t border-neutral-200 p-3">
          {editableStatus && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Status</p>
              <ListingStatusControl propertyId={property.id} status={status} onChange={setStatus} />
            </div>
          )}
          {footer}
        </div>
      )}
    </div>
  );
}
