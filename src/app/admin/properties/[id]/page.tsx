import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EditListingBanner } from "@/components/EditListingBanner";
import { MediaManager } from "@/components/MediaManager";
import { PropertyForm } from "@/components/PropertyForm";
import { T } from "@/components/T";
import { getCurrentUser } from "@/lib/auth";
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
      <EditListingBanner
        address={property.address}
        interested={interested}
        imported={imported}
        photos={photos}
        placed={placed}
        showAdminNote={user.role === "admin"}
      />
      <div className="grid min-w-0 grid-cols-3 gap-2 sm:gap-3">
        <Link
          href={`/properties/${property.id}`}
          className="inline-flex min-w-0 items-center justify-center rounded-full bg-black px-1 py-3 text-center text-xs font-semibold leading-tight text-white hover:bg-neutral-800 sm:px-2 sm:text-sm"
        >
          <T id="admin.viewPage" />
        </Link>
        <div id="listing-actions" className="contents" />
      </div>
      <div className="grid min-w-0 gap-10 lg:grid-cols-2">
        <PropertyForm property={property} actionsHostId="listing-actions" allowDelete={user.role === "super_admin"} />
        <MediaManager propertyId={property.id} media={media} />
      </div>
    </div>
  );
}
