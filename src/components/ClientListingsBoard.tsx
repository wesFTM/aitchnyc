"use client";

/* Logos are served from the private media bucket, so skip the image optimizer. */
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { LikeButton } from "@/components/LikeButton";
import { RequestTourButton } from "@/components/RequestTourButton";
import { DownloadPdfButton } from "@/components/ListingPdfActions";
import { ListingCard } from "@/components/ListingCard";
import { formatAddress } from "@/lib/format";
import type { ListingPdfSource } from "@/lib/listing-pdf-source";
import type { PropertyListItem } from "@/lib/types";

export type ClientListingItem = {
  property: PropertyListItem;
  href: string;
  coverSrc: string | null;
  pdf: ListingPdfSource;
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
}: {
  name: string;
  logoSrc: string | null;
  items: ClientListingItem[];
  filename: string;
  likeEndpoint: string;
  tourEndpoint: string;
  likedIds: string[];
  tourIds: string[];
}) {
  const [likedIds, setLikedIds] = useState(initialLikedIds);
  const [tourIds, setTourIds] = useState(initialTourIds);
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
    if (!liked) setTourIds((current) => current.filter((id) => id !== propertyId));
  }

  function markTour(propertyId: string, requested: boolean) {
    setTourIds((current) => {
      if (requested) return current.includes(propertyId) ? current : [propertyId, ...current];
      return current.filter((id) => id !== propertyId);
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {logoSrc && (
            <img
              src={logoSrc}
              alt={`${name} logo`}
              className="h-14 w-auto max-w-36 shrink-0 object-contain sm:h-16"
            />
          )}
          <div className="min-w-0">
            <h1 className="break-words text-3xl font-semibold">Your listings</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Prepared for {name}. Like the ones you&apos;re interested in, then request a tour.
            </p>
          </div>
        </div>
        <DownloadPdfButton listings={items.map((item) => item.pdf)} filename={filename} />
      </div>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-6 text-sm text-neutral-600">
          Nothing here yet. When your agent adds a property for you, it will show up on this page.
        </div>
      ) : (
        <>
          {likedItems.length > 0 && (
            <section className="rounded-2xl border-2 border-black bg-white p-4 sm:p-5" aria-label="Liked">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Featured</p>
              <h2 className="text-lg font-semibold">Liked</h2>
              <div className="mt-4">
                <ListingGrid
                  items={likedItems}
                  liked
                  likeEndpoint={likeEndpoint}
                  tourEndpoint={tourEndpoint}
                  tourIds={tourIds}
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
  onLiked,
  onTour,
}: {
  items: ClientListingItem[];
  liked?: boolean;
  likeEndpoint: string;
  tourEndpoint: string;
  tourIds: string[];
  onLiked: (propertyId: string, liked: boolean) => void;
  onTour: (propertyId: string, requested: boolean) => void;
}) {
  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const name = formatAddress(item.property.address, item.property.unit);
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
              liked ? (
                <RequestTourButton
                  propertyId={item.property.id}
                  name={name}
                  requested={tourIds.includes(item.property.id)}
                  endpoint={tourEndpoint}
                  block
                  onChange={(next) => onTour(item.property.id, next)}
                />
              ) : undefined
            }
          />
        );
      })}
    </div>
  );
}
