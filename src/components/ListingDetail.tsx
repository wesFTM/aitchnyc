"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { DocumentLinks } from "@/components/DocumentLinks";
import { Gallery } from "@/components/Gallery";
import { ListingStatusBadge, ListingStatusControl } from "@/components/ListingStatusControl";
import { PropertyMapLoader } from "@/components/PropertyMapLoader";
import { ShareButton } from "@/components/ShareButton";
import { useI18n } from "@/components/LanguageProvider";
import { amenityLabels, parseAmenities } from "@/lib/amenities";
import { displayStatus, formatAddress, formatFacts, formatMoney, formatPrice, listingTypeLabel } from "@/lib/format";
import { localeTag } from "@/lib/locale";
import type { Property, PropertyMedia } from "@/lib/types";

export function ListingDetail({
  property,
  media,
  backHref,
  mediaBase,
  mapHref,
  like,
  canEditStatus = false,
  documents = [],
}: {
  property: Property;
  media: PropertyMedia[];
  backHref: string;
  mediaBase: string;
  mapHref: string;
  like?: ReactNode;
  canEditStatus?: boolean;
  documents?: { href: string; name: string }[];
}) {
  const { locale, t } = useI18n();
  const amenities = amenityLabels(parseAmenities(property.amenities), locale);
  const number = (value: number) => value.toLocaleString(localeTag(locale));
  const pins =
    property.lat != null && property.lng != null
      ? [
          {
            id: property.id,
            lat: property.lat,
            lng: property.lng,
            title: formatAddress(property.address, property.unit),
            detail: formatPrice(property.price_cents, property.listing_type, locale),
            priceCents: property.price_cents,
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
            {t("listings.back")}
          </Link>
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
            <span className="rounded-full border border-black px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide">
              {listingTypeLabel(property.listing_type, locale)}
            </span>
            {canEditStatus ? (
              <div className="min-w-0 basis-full">
                <ListingStatusControl propertyId={property.id} status={displayStatus(property)} size="md" />
              </div>
            ) : (
              <ListingStatusBadge status={displayStatus(property)} />
            )}
          </div>
          {like ?? (
            <ShareButton
              title={formatAddress(property.address, property.unit)}
              text={formatPrice(property.price_cents, property.listing_type, locale)}
            />
          )}
          <h1 className="break-words text-3xl font-semibold leading-tight">{property.address}</h1>
          {property.unit && <p className="text-neutral-600">{t("listings.unit", { unit: property.unit })}</p>}
          <p className="text-2xl font-semibold">{formatPrice(property.price_cents, property.listing_type, locale)}</p>
          {property.listing_type === "commercial" && <p className="text-sm text-neutral-500">{t("listings.askingRent")}</p>}
          {property.neighborhood && <p className="text-neutral-600">{property.neighborhood}</p>}
        </div>
        {property.listing_type === "commercial" ? (
          <dl className="grid min-w-0 grid-cols-2 gap-3 text-sm">
            <Fact
              label={t("fact.keyMoney")}
              value={formatMoney(property.key_money_cents ?? 0, locale)}
            />
            <Fact label={t("fact.sqftGround")} value={property.sqft != null ? number(property.sqft) : undefined} />
            <Fact label={t("fact.totalSqft")} value={property.sqft_optional != null ? number(property.sqft_optional) : undefined} />
            <Fact label={t("fact.possession")} value={property.possession || undefined} />
            <Fact label={t("fact.terms")} value={property.terms || undefined} />
            <Fact label={t("fact.frontage")} value={property.frontage || undefined} />
            <Fact label={t("fact.ceiling")} value={property.ceiling_height || undefined} />
          </dl>
        ) : (
          <dl className="grid min-w-0 grid-cols-2 gap-3 text-sm">
            <Fact label={t("fact.bedrooms")} value={property.bedrooms?.toString()} />
            <Fact label={t("fact.bathrooms")} value={property.bathrooms?.toString()} />
            <Fact label={t("fact.sqft")} value={property.sqft != null ? number(property.sqft) : undefined} />
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
        {formatFacts(property, locale) && <p className="sr-only">{formatFacts(property, locale)}</p>}
        {property.description && (
          <p className="break-words whitespace-pre-wrap text-sm leading-6 text-neutral-800">{property.description}</p>
        )}
        <DocumentLinks documents={documents} />
        {property.listing_type === "commercial" && property.neighboring_tenants && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("fact.neighbors")}</h2>
            <p className="mt-2 break-words whitespace-pre-wrap text-sm leading-6 text-neutral-800">{property.neighboring_tenants}</p>
          </div>
        )}
        <div className="h-80 min-w-0 max-w-full overflow-hidden rounded-2xl border border-neutral-200">
          {pins.length > 0 ? (
            <PropertyMapLoader pins={pins} filters={false} />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-neutral-500">
              {t("listings.addressNotOnMap")}
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
