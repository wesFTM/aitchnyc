import { notFound, redirect } from "next/navigation";
import { AppBar } from "@/components/AppBar";
import { ListingDetail } from "@/components/ListingDetail";
import { ListingInterest } from "@/components/ListingInterest";
import { getCurrentUser } from "@/lib/auth";
import { formatAddress } from "@/lib/format";
import { getListingInterest, getProperty, listClientDocuments, listingForClient, listMedia, propertyForEditor, userCanSeeProperty } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const stored = user ? await getProperty(id) : null;
  const allowed = Boolean(user && stored && (await userCanSeeProperty(user, stored.id)));
  const property =
    allowed && user && stored
      ? user.role === "client"
        ? await listingForClient(user, stored)
        : user.role === "admin" && stored.created_by === user.id
          ? await propertyForEditor(user.id, stored)
          : stored
      : stored;
  return {
    title: allowed && property ? `${property.address} · Aitch NYC` : "Listing · Aitch NYC",
    robots: { index: false, follow: false },
  };
}

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/properties/${id}`);
  const stored = await getProperty(id);
  if (!stored || !(await userCanSeeProperty(user, stored.id))) notFound();
  const property =
    user.role === "client"
      ? await listingForClient(user, stored)
      : user.role === "admin" && stored.created_by === user.id
        ? await propertyForEditor(user.id, stored)
        : stored;
  const media = await listMedia(id);
  const interest = user.role === "client" ? await getListingInterest(user.id, property.id) : null;
  const documents =
    user.role === "client"
      ? (await listClientDocuments([user.id]))
          .filter((document) => document.property_id === property.id)
          .map((document) => ({ href: `/api/documents/${document.id}`, name: document.original_name }))
      : [];

  return (
    <div className="min-h-screen w-full min-w-0 max-w-full overflow-x-clip bg-white text-black">
      <AppBar user={user} />
      <ListingDetail
        property={property}
        media={media}
        backHref={user.role === "client" ? "/account" : "/admin"}
        mediaBase="/api/media"
        mapHref={`/properties/${property.id}`}
        canEditStatus={user.role === "super_admin" || (user.role === "admin" && stored.created_by === user.id)}
        documents={documents}
        like={
          interest ? (
            <ListingInterest
              propertyId={property.id}
              name={formatAddress(property.address, property.unit)}
              liked={interest.liked}
              tourRequested={interest.tourRequested}
              tourScheduledAt={interest.tourScheduledAt}
              likeEndpoint="/api/likes"
              tourEndpoint="/api/tours"
              priceCents={property.price_cents}
              listingType={property.listing_type}
            />
          ) : undefined
        }
      />
    </div>
  );
}
