import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MediaManager } from "@/components/MediaManager";
import { PropertyForm } from "@/components/PropertyForm";
import { getCurrentUser } from "@/lib/auth";
import { formatTourWhen } from "@/lib/format";
import { adminCanViewProperty, getProperty, listInterestedClients, listMedia, propertyForEditor } from "@/lib/queries";

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
  const user = await getCurrentUser();
  const stored = await getProperty(id);
  if (!user || !stored || (user.role !== "super_admin" && user.role !== "admin")) notFound();
  if (user.role === "admin" && (stored.hidden || stored.created_by !== user.id)) {
    if (await adminCanViewProperty(user.id, id)) redirect(`/properties/${id}`);
    notFound();
  }
  const property = user.role === "admin" ? await propertyForEditor(user.id, stored) : stored;
  const [media, interested] = await Promise.all([listMedia(id), listInterestedClients(id)]);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Edit listing</p>
          <h1 className="mt-1 break-words text-3xl font-semibold">{property.address}</h1>
          {interested.map((client) =>
            client.tour_requested && client.tour_scheduled_at ? (
              <p key={client.id} className="mt-2 text-sm font-medium text-green-700">
                Tour scheduled with {client.name} · {formatTourWhen(client.tour_scheduled_at)}
              </p>
            ) : null,
          )}
          {interested.some((client) => client.tour_requested && !client.tour_scheduled_at) && (
            <p className="mt-2 text-sm font-medium text-green-700">
              Tour requested by{" "}
              {interested
                .filter((client) => client.tour_requested && !client.tour_scheduled_at)
                .map((client) => client.name)
                .join(", ")}
            </p>
          )}
          {interested.some((client) => !client.tour_requested) && (
            <p className="mt-2 text-sm text-neutral-600">
              Liked by {interested.filter((client) => !client.tour_requested).map((client) => client.name).join(", ")}
            </p>
          )}
        </div>
        <div className="grid min-w-0 grid-cols-3 gap-2 sm:gap-3">
          <Link
            href={`/properties/${property.id}`}
            className="inline-flex min-w-0 items-center justify-center rounded-full bg-black px-1 py-3 text-center text-xs font-semibold leading-tight text-white hover:bg-neutral-800 sm:px-2 sm:text-sm"
          >
            View page
          </Link>
          <div id="listing-actions" className="contents" />
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
      {user.role === "admin" && (
        <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          Saving updates your list and your clients&apos; pages. The master listing stays as it was when you added it. Photos stay on the shared listing.
        </p>
      )}
      <div className="grid min-w-0 gap-10 lg:grid-cols-2">
        <PropertyForm property={property} actionsHostId="listing-actions" allowDelete={user.role === "super_admin"} />
        <MediaManager propertyId={property.id} media={media} />
      </div>
    </div>
  );
}
