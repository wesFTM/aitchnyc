import Link from "next/link";
import { notFound } from "next/navigation";
import { MediaManager } from "@/components/MediaManager";
import { PropertyForm } from "@/components/PropertyForm";
import { getProperty, listInterestedClients, listMedia } from "@/lib/queries";
import { buttonClass } from "@/lib/styles";

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
  searchParams: Promise<{ placed?: string; imported?: string; photos?: string }>;
}) {
  const { id } = await params;
  const { placed, imported, photos } = await searchParams;
  const property = await getProperty(id);
  if (!property) notFound();
  const [media, interested] = await Promise.all([listMedia(id), listInterestedClients(id)]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Edit listing</p>
          <h1 className="mt-1 break-words text-3xl font-semibold">{property.address}</h1>
          {interested.some((client) => client.tour_requested) && (
            <p className="mt-2 text-sm font-medium text-green-700">
              Tour requested by {interested.filter((client) => client.tour_requested).map((client) => client.name).join(", ")}
            </p>
          )}
          {interested.some((client) => !client.tour_requested) && (
            <p className="mt-2 text-sm text-neutral-600">
              Liked by {interested.filter((client) => !client.tour_requested).map((client) => client.name).join(", ")}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div id="listing-actions" />
          <Link href={`/properties/${property.id}`} className={buttonClass}>
            View page
          </Link>
        </div>
      </div>
      {imported === "1" && (
        <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-800">
          Imported from the link. The details we could read are filled in.
          {photos === "0" ? " Photos couldn't be saved, so add them here." : " Photos are saved with the listing."} Add
          anything that was left blank, then save.
        </p>
      )}
      {placed === "0" && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Listing saved, but the address could not be placed on the map. Check the street address, then save again.
        </p>
      )}
      <div className="grid min-w-0 gap-10 lg:grid-cols-2">
        <PropertyForm property={property} actionsHostId="listing-actions" />
        <MediaManager propertyId={property.id} media={media} />
      </div>
    </div>
  );
}
