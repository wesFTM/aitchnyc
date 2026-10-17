import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppBar } from "@/components/AppBar";
import { Gallery } from "@/components/Gallery";
import { PropertyMapLoader } from "@/components/PropertyMapLoader";
import { getCurrentUser } from "@/lib/auth";
import { formatAddress, formatFacts, formatPrice, listingTypeLabel, statusLabel } from "@/lib/format";
import { getProperty, listMedia, userCanViewProperty } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const property = user ? await getProperty(id) : null;
  const allowed =
    user &&
    property &&
    (user.role === "super_admin" || (await userCanViewProperty(user.id, property.id)));
  return {
    title: allowed && property ? `${property.address} · Aitch NYC` : "Listing · Aitch NYC",
    robots: { index: false, follow: false },
  };
}

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/properties/${id}`);
  const property = await getProperty(id);
  if (!property) notFound();
  if (user.role !== "super_admin" && !(await userCanViewProperty(user.id, property.id))) notFound();
  const media = await listMedia(id);
  const pins =
    property.lat != null && property.lng != null
      ? [
          {
            id: property.id,
            lat: property.lat,
            lng: property.lng,
            title: formatAddress(property.address, property.unit),
            detail: formatPrice(property.price_cents, property.listing_type),
            href: `/properties/${property.id}`,
          },
        ]
      : [];

  return (
    <div className="min-h-screen bg-white text-black">
      <AppBar user={user} />
      <main className="mx-auto grid max-w-6xl gap-10 px-4 py-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Gallery media={media} />
        <div className="space-y-6">
          <div className="space-y-3">
            <Link
              href={user.role === "super_admin" ? "/admin" : "/account"}
              className="text-sm font-semibold text-neutral-500 hover:text-black"
            >
              Back
            </Link>
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
              <span className="rounded-full border border-black px-2 py-0.5">
                {listingTypeLabel(property.listing_type)}
              </span>
              <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-neutral-600">
                {statusLabel(property.status)}
              </span>
            </div>
            <h1 className="text-3xl font-semibold leading-tight">{property.address}</h1>
            {property.unit && <p className="text-neutral-600">Unit {property.unit}</p>}
            <p className="text-2xl font-semibold">{formatPrice(property.price_cents, property.listing_type)}</p>
            {property.neighborhood && <p className="text-neutral-600">{property.neighborhood}</p>}
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Fact label="Bedrooms" value={property.bedrooms?.toString()} />
            <Fact label="Bathrooms" value={property.bathrooms?.toString()} />
            <Fact label="Square footage" value={property.sqft?.toLocaleString("en-US")} />
            <Fact label="Washer in unit" value={property.washer_in_unit ? "Yes" : "No"} />
          </dl>
          {formatFacts(property) && <p className="sr-only">{formatFacts(property)}</p>}
          {property.description && (
            <p className="whitespace-pre-wrap text-sm leading-6 text-neutral-800">{property.description}</p>
          )}
          <div className="h-64 overflow-hidden rounded-2xl border border-neutral-200">
            {pins.length > 0 ? (
              <PropertyMapLoader pins={pins} />
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-neutral-500">
                This address is not on the map yet.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Fact({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 px-3 py-2">
      <dt className="text-xs uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="mt-1 font-medium">{value || "—"}</dd>
    </div>
  );
}
