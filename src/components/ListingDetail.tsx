import type { ReactNode } from "react";
import Link from "next/link";
import { Gallery } from "@/components/Gallery";
import { PropertyMapLoader } from "@/components/PropertyMapLoader";
import { amenityLabels, parseAmenities } from "@/lib/amenities";
import { displayStatus, formatAddress, formatFacts, formatMoney, formatPrice, listingTypeLabel, statusLabel } from "@/lib/format";
import type { Property, PropertyMedia } from "@/lib/types";

export function ListingDetail({
  property,
  media,
  backHref,
  mediaBase,
  mapHref,
  like,
}: {
  property: Property;
  media: PropertyMedia[];
  backHref: string;
  mediaBase: string;
  mapHref: string;
  like?: ReactNode;
}) {
  const amenities = amenityLabels(parseAmenities(property.amenities));
  const pins =
    property.lat != null && property.lng != null
      ? [
          {
            id: property.id,
            lat: property.lat,
            lng: property.lng,
            title: formatAddress(property.address, property.unit),
            detail: formatPrice(property.price_cents, property.listing_type),
            href: mapHref,
            listingType: property.listing_type,
          },
        ]
      : [];

  return (
    <main className="mx-auto grid w-full min-w-0 max-w-6xl gap-10 px-4 py-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <Gallery media={media} mediaBase={mediaBase} />
      <div className="min-w-0 space-y-6">
        <div className="space-y-3">
          <Link href={backHref} className="text-sm font-semibold text-neutral-500 hover:text-black">
            Back
          </Link>
          <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
            <span className="rounded-full border border-black px-2 py-0.5">
              {listingTypeLabel(property.listing_type)}
            </span>
            <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-neutral-600">
              {statusLabel(displayStatus(property))}
            </span>
          </div>
          {like}
          <h1 className="break-words text-3xl font-semibold leading-tight">{property.address}</h1>
          {property.unit && <p className="text-neutral-600">Unit {property.unit}</p>}
          <p className="text-2xl font-semibold">{formatPrice(property.price_cents, property.listing_type)}</p>
          {property.listing_type === "commercial" && <p className="text-sm text-neutral-500">Asking rent</p>}
          {property.neighborhood && <p className="text-neutral-600">{property.neighborhood}</p>}
        </div>
        {property.listing_type === "commercial" ? (
          <dl className="grid min-w-0 grid-cols-2 gap-3 text-sm">
            <Fact
              label="Key money"
              value={formatMoney(property.key_money_cents ?? 0)}
            />
            <Fact label="Sqft - Ground" value={property.sqft?.toLocaleString("en-US")} />
            <Fact label="Total Sqft" value={property.sqft_optional?.toLocaleString("en-US")} />
            <Fact label="Possession" value={property.possession || undefined} />
            <Fact label="Terms" value={property.terms || undefined} />
            <Fact label="Frontage" value={property.frontage || undefined} />
            <Fact label="Ceiling height" value={property.ceiling_height || undefined} />
          </dl>
        ) : (
          <dl className="grid min-w-0 grid-cols-2 gap-3 text-sm">
            <Fact label="Bedrooms" value={property.bedrooms?.toString()} />
            <Fact label="Bathrooms" value={property.bathrooms?.toString()} />
            <Fact label="Square footage" value={property.sqft?.toLocaleString("en-US")} />
          </dl>
        )}
        {property.listing_type !== "commercial" && amenities.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {amenities.map((label) => (
              <span key={label} className="rounded-full border border-neutral-300 px-2.5 py-1 text-xs font-medium">
                {label}
              </span>
            ))}
          </div>
        )}
        {formatFacts(property) && <p className="sr-only">{formatFacts(property)}</p>}
        {property.description && (
          <p className="break-words whitespace-pre-wrap text-sm leading-6 text-neutral-800">{property.description}</p>
        )}
        {property.listing_type === "commercial" && property.neighboring_tenants && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Neighboring tenants</h2>
            <p className="mt-2 break-words whitespace-pre-wrap text-sm leading-6 text-neutral-800">{property.neighboring_tenants}</p>
          </div>
        )}
        <div className="h-80 min-w-0 max-w-full overflow-hidden rounded-2xl border border-neutral-200">
          {pins.length > 0 ? (
            <PropertyMapLoader pins={pins} filters={false} />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-neutral-500">
              This address is not on the map yet.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Fact({ label, value }: { label: string; value?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-neutral-200 px-3 py-2">
      <dt className="break-words text-xs uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="mt-1 break-words font-medium">{value || "—"}</dd>
    </div>
  );
}
