/* Logos are served from the private media bucket, so skip the image optimizer. */
/* eslint-disable @next/next/no-img-element */
import { DownloadPdfButton } from "@/components/ListingPdfActions";
import { ListingCard } from "@/components/ListingCard";
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
}: {
  name: string;
  logoSrc: string | null;
  items: ClientListingItem[];
  filename: string;
}) {
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
            <p className="mt-1 text-sm text-neutral-500">Prepared for {name}.</p>
          </div>
        </div>
        <DownloadPdfButton listings={items.map((item) => item.pdf)} filename={filename} />
      </div>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-6 text-sm text-neutral-600">
          Nothing here yet. When your agent adds a property for you, it will show up on this page.
        </div>
      ) : (
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <ListingCard key={item.property.id} property={item.property} href={item.href} coverSrc={item.coverSrc} />
          ))}
        </div>
      )}
    </>
  );
}
