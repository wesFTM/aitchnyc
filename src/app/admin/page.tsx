import { ListingCard } from "@/components/ListingCard";
import { PropertyForm } from "@/components/PropertyForm";
import { PropertyMapLoader } from "@/components/PropertyMapLoader";
import { formatAddress, formatPrice } from "@/lib/format";
import { listProperties } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard · Aitch NYC" };

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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {properties.length === 0
            ? "Add an address to put it on the map."
            : `${properties.length} saved · ${pins.length} on the map`}
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,28rem)_1fr]">
        <section className="rounded-2xl border border-neutral-200 p-5">
          <h2 className="text-lg font-semibold">New listing</h2>
          <p className="mt-1 mb-5 text-sm text-neutral-500">
            Sale or rental, address, unit, price, neighborhood, size, beds, baths, washer, and status.
            Photos and one video are added on the next screen. Include the city and state so the pin lands.
          </p>
          <PropertyForm />
        </section>
        <div className="h-[420px] overflow-hidden rounded-2xl border border-neutral-200 lg:sticky lg:top-6 lg:h-[calc(100vh-8rem)]">
          <PropertyMapLoader pins={pins} />
        </div>
      </div>

      {properties.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Saved listings</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {properties.map((property) => (
              <ListingCard key={property.id} property={property} href={`/admin/properties/${property.id}`} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
