import { ImportListing } from "@/components/ImportListing";
import { StreetEasyImport } from "@/components/StreetEasyImport";
import { SavedListings } from "@/components/SavedListings";
import { PrintListingsButton } from "@/components/ListingPdfActions";
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
      listingType: property.listing_type,
    }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {properties.length === 0
              ? "Add an address to put it on the map."
              : `${properties.length} saved · ${pins.length} on the map`}
          </p>
        </div>
        <PrintListingsButton
          properties={properties.map((property) => ({
            id: property.id,
            label: formatAddress(property.address, property.unit),
          }))}
        />
      </div>

      <div className="grid min-w-0 items-stretch gap-6 md:grid-cols-2">
        <StreetEasyImport />
        <ImportListing />
      </div>

      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
        <section className="w-full min-w-0 max-w-full rounded-2xl border border-neutral-200 p-5">
          <h2 className="mb-5 text-lg font-semibold">Add New Listing</h2>
          <PropertyForm />
        </section>
        <div className="h-[420px] w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-neutral-200 lg:sticky lg:top-6 lg:h-[calc(100vh-8rem)]">
          <PropertyMapLoader pins={pins} />
        </div>
      </div>

      {properties.length > 0 && <SavedListings properties={properties} />}
    </div>
  );
}
