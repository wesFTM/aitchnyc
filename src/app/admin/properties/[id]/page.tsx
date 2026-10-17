import Link from "next/link";
import { notFound } from "next/navigation";
import { MediaManager } from "@/components/MediaManager";
import { PropertyForm } from "@/components/PropertyForm";
import { getProperty, listMedia } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const property = await getProperty(id);
  return { title: property ? `${property.address} · Edit` : "Listing" };
}

export default async function EditPropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ placed?: string }>;
}) {
  const { id } = await params;
  const { placed } = await searchParams;
  const property = await getProperty(id);
  if (!property) notFound();
  const media = await listMedia(id);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Edit listing</p>
          <h1 className="mt-1 text-3xl font-semibold">{property.address}</h1>
        </div>
        <Link href={`/properties/${property.id}`} className="text-sm font-semibold underline">
          View page
        </Link>
      </div>
      {placed === "0" && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Listing saved, but the address could not be placed on the map. Add the city and state, then save again.
        </p>
      )}
      <div className="grid gap-10 lg:grid-cols-2">
        <PropertyForm property={property} />
        <MediaManager propertyId={property.id} media={media} />
      </div>
    </div>
  );
}
