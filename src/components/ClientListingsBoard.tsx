"use client";

/* Logos are served from the private media bucket, so skip the image optimizer. */
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { DocumentLinks } from "@/components/DocumentLinks";
import { LikeButton } from "@/components/LikeButton";
import { RequestTourButton } from "@/components/RequestTourButton";
import { DownloadPdfButton } from "@/components/ListingPdfActions";
import { ListingCard } from "@/components/ListingCard";
import { PropertyMapLoader } from "@/components/PropertyMapLoader";
import { TourScheduleNote } from "@/components/TourScheduleNote";
import { useI18n } from "@/components/LanguageProvider";
import { LIKED_PIN_COLOR, formatAddress, formatPrice } from "@/lib/format";
import type { ListingPdfSource } from "@/lib/listing-pdf-source";
import type { PropertyListItem } from "@/lib/types";

export type ClientListingItem = {
  property: PropertyListItem;
  href: string;
  coverSrc: string | null;
  pdf: ListingPdfSource;
  documents?: { href: string; name: string }[];
};

export function ClientListingsBoard({
  name,
  logoSrc,
  items,
  filename,
  likeEndpoint,
  tourEndpoint,
  likedIds: initialLikedIds,
  tourIds: initialTourIds,
  tourSchedules,
}: {
  name: string;
  logoSrc: string | null;
  items: ClientListingItem[];
  filename: string;
  likeEndpoint: string;
  tourEndpoint: string;
  likedIds: string[];
  tourIds: string[];
  tourSchedules: Record<string, string>;
}) {
  const { locale, t } = useI18n();
  const [likedIds, setLikedIds] = useState(initialLikedIds);
  const [tourIds, setTourIds] = useState(initialTourIds);
  const [clearedSchedules, setClearedSchedules] = useState<string[]>([]);
  const [mapOpen, setMapOpen] = useState(false);
  const byId = new Map(items.map((item) => [item.property.id, item]));
  const likedItems = likedIds.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
  const otherItems = items.filter((item) => !likedIds.includes(item.property.id));

  function markLiked(propertyId: string, liked: boolean) {
    setLikedIds((current) => {
      if (liked) return current.includes(propertyId) ? current : [propertyId, ...current];
      return current.filter((id) => id !== propertyId);
    });
    if (!liked) {
      setTourIds((current) => current.filter((id) => id !== propertyId));
      setClearedSchedules((current) => (current.includes(propertyId) ? current : [...current, propertyId]));
    }
  }

  function markTour(propertyId: string, requested: boolean) {
    setTourIds((current) => {
      if (requested) return current.includes(propertyId) ? current : [propertyId, ...current];
      return current.filter((id) => id !== propertyId);
    });
    if (!requested) {
      setClearedSchedules((current) => (current.includes(propertyId) ? current : [...current, propertyId]));
    }
  }

  function scheduledAtFor(propertyId: string) {
    if (clearedSchedules.includes(propertyId) || !tourIds.includes(propertyId)) return null;
    return tourSchedules[propertyId] ?? null;
  }

  const pins = items.flatMap((item) => {
    const { lat, lng } = item.property;
    if (lat == null || lng == null) return [];
    const liked = likedIds.includes(item.property.id);
    return [
      {
        id: item.property.id,
        lat,
        lng,
        title: formatAddress(item.property.address, item.property.unit),
        detail: formatPrice(item.property.price_cents, item.property.listing_type, locale),
        priceCents: item.property.price_cents,
        href: item.href,
        listingType: item.property.listing_type,
        liked,
        color: liked ? LIKED_PIN_COLOR : undefined,
      },
    ];
  });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {logoSrc && (
            <img
              src={logoSrc}
              alt={t("listings.logoAlt", { name })}
              className="h-14 w-auto max-w-36 shrink-0 object-contain sm:h-16"
            />
          )}
          <div className="min-w-0">
            <h1 className="break-words text-3xl font-semibold">{t("listings.current")}</h1>
            <p className="mt-1 text-sm text-neutral-500">{t("listings.prepared", { name })}</p>
          </div>
        </div>
        <DownloadPdfButton listings={items.map((item) => item.pdf)} filename={filename} />
      </div>
      {pins.length > 0 && (
        <section className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-neutral-200">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            aria-expanded={mapOpen}
            onClick={() => setMapOpen((current) => !current)}
          >
            <span className="text-lg font-semibold">{t("listings.myMap")}</span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-neutral-500 transition ${mapOpen ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
          {mapOpen && (
            <div className="h-[420px] w-full min-w-0 max-w-full border-t border-neutral-200">
              <PropertyMapLoader pins={pins} filterSet="liked" />
            </div>
          )}
        </section>
      )}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-6 text-sm text-neutral-600">
          {t("listings.empty")}
        </div>
      ) : (
        <>
          {likedItems.length > 0 && (
            <section className="min-w-0 max-w-full overflow-hidden rounded-2xl border-2 border-black bg-white p-4 sm:p-5" aria-label={t("listings.liked")}>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("listings.featured")}</p>
              <h2 className="text-lg font-semibold">{t("listings.liked")}</h2>
              <div className="mt-4">
                <ListingGrid
                  items={likedItems}
                  liked
                  likeEndpoint={likeEndpoint}
                  tourEndpoint={tourEndpoint}
                  tourIds={tourIds}
                  scheduledAtFor={scheduledAtFor}
                  onLiked={markLiked}
                  onTour={markTour}
                />
              </div>
            </section>
          )}
          {otherItems.length > 0 && (
            <ListingGrid
              items={otherItems}
              likeEndpoint={likeEndpoint}
              tourEndpoint={tourEndpoint}
              tourIds={tourIds}
              scheduledAtFor={scheduledAtFor}
              onLiked={markLiked}
              onTour={markTour}
            />
          )}
        </>
      )}
    </>
  );
}

function ListingGrid({
  items,
  liked = false,
  likeEndpoint,
  tourEndpoint,
  tourIds,
  scheduledAtFor,
  onLiked,
  onTour,
}: {
  items: ClientListingItem[];
  liked?: boolean;
  likeEndpoint: string;
  tourEndpoint: string;
  tourIds: string[];
  scheduledAtFor: (propertyId: string) => string | null;
  onLiked: (propertyId: string, liked: boolean) => void;
  onTour: (propertyId: string, requested: boolean) => void;
}) {
  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const name = formatAddress(item.property.address, item.property.unit);
        const scheduledAt = scheduledAtFor(item.property.id);
        const documents = item.documents ?? [];
        const showTour = liked;
        return (
          <ListingCard
            key={item.property.id}
            property={item.property}
            href={item.href}
            coverSrc={item.coverSrc}
            like={
              <LikeButton
                propertyId={item.property.id}
                name={name}
                liked={liked}
                endpoint={likeEndpoint}
                onChange={(next) => onLiked(item.property.id, next)}
              />
            }
            footer={
              documents.length > 0 || showTour ? (
                <div className="space-y-2">
                  <DocumentLinks documents={documents} />
                  {showTour && scheduledAt && <TourScheduleNote scheduledAt={scheduledAt} />}
                  {showTour && (
                    <RequestTourButton
                      propertyId={item.property.id}
                      name={name}
                      requested={tourIds.includes(item.property.id)}
                      endpoint={tourEndpoint}
                      block
                      onChange={(next) => onTour(item.property.id, next)}
                    />
                  )}
                </div>
              ) : undefined
            }
          />
        );
      })}
    </div>
  );
}
