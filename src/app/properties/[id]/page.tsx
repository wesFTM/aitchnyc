import { notFound, redirect } from "next/navigation";
import { AppBar } from "@/components/AppBar";
import { ListingDetail } from "@/components/ListingDetail";
import { ListingInterest } from "@/components/ListingInterest";
import { getCurrentUser } from "@/lib/auth";
import { formatAddress } from "@/lib/format";
import { getListingInterest, getProperty, listMedia, userCanViewProperty } from "@/lib/queries";

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
  const interest = user.role === "client" ? await getListingInterest(user.id, property.id) : null;

  return (
    <div className="min-h-screen w-full min-w-0 max-w-full overflow-x-clip bg-white text-black">
      <AppBar user={user} />
      <ListingDetail
        property={property}
        media={media}
        backHref={user.role === "super_admin" ? "/admin" : "/account"}
        mediaBase="/api/media"
        mapHref={`/properties/${property.id}`}
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
            />
          ) : undefined
        }
      />
    </div>
  );
}
