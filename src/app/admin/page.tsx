import Link from "next/link";
import { ListingCard } from "@/components/ListingCard";
import { PropertyMapLoader } from "@/components/PropertyMapLoader";
import { formatAddress, formatPrice } from "@/lib/format";
import { listProperties } from "@/lib/queries";
import { buttonClass } from "@/lib/styles";

export const dynamic = "force-dynamic";

export const metadata = { title: "Listings · Aitch NYC" };

export default async function AdminPage() {
  const properties = await listProperties();
  const pins = properties
    .filter((property) => property.lat != null && property.lng != null)
    .map((property) => ({
      id: property.id,
      lat: property.lat as number,
      lng: property.lng as number,
      title: formatAddress(property.address, property.unit),
      detail: formatPrice(property.price_cents, property.listing_type),
      href: `/admin/properties/${property.id}`,
    }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Listings</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {properties.length === 0
              ? "Add an address to put it on the map."
              : `${properties.length} saved · ${pins.length} on the map`}
          </p>
        </div>
        <Link href="/admin/properties/new" className={buttonClass}>
          New listing
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr] lg:items-start">
        <div className="order-2 space-y-4 lg:order-1">
          {properties.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 p-6 text-sm text-neutral-600">
              No listings yet. Include the city and state so the pin lands in the right place.
            </div>
          ) : (
            properties.map((property) => (
              <ListingCard key={property.id} property={property} href={`/admin/properties/${property.id}`} />
            ))
          )}
        </div>
        <div className="order-1 h-[420px] overflow-hidden rounded-2xl border border-neutral-200 lg:sticky lg:top-6 lg:order-2 lg:h-[calc(100vh-8rem)]">
          <PropertyMapLoader pins={pins} />
        </div>
      </div>
    </div>
  );
}
