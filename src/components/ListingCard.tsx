/* Authenticated media can't go through the image optimizer. */
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { formatAddress, formatFacts, formatPrice, listingTypeLabel, statusLabel } from "@/lib/format";
import type { PropertyListItem } from "@/lib/types";

export function ListingCard({ property, href }: { property: PropertyListItem; href: string }) {
  return (
    <Link href={href} className="group block overflow-hidden rounded-2xl border border-neutral-200 bg-white text-black">
      <div className="aspect-[4/3] bg-neutral-100">
        {property.cover_id ? (
          <img
            src={`/api/media/${property.cover_id}`}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-neutral-400">No photo</div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
          <span className="rounded-full border border-black px-2 py-0.5">{listingTypeLabel(property.listing_type)}</span>
          <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-neutral-600">
            {statusLabel(property.status)}
          </span>
        </div>
        <h2 className="text-base font-semibold leading-snug group-hover:underline">
          {formatAddress(property.address, property.unit)}
        </h2>
        <p className="text-sm text-neutral-600">
          {[property.neighborhood, formatPrice(property.price_cents, property.listing_type)].filter(Boolean).join(" · ")}
        </p>
        <p className="text-sm text-neutral-500">{formatFacts(property) || "Details coming"}</p>
        {property.lat == null && <p className="text-xs text-amber-700">Not on the map yet</p>}
      </div>
    </Link>
  );
}
