import { notFound } from "next/navigation";
import { ClientHeader } from "@/components/ClientHeader";
import { ListingDetail } from "@/components/ListingDetail";
import { ListingInterest } from "@/components/ListingInterest";
import { formatAddress, formatPrice } from "@/lib/format";
import { clientAsCreatorSees, findClientByShareToken, getListingInterest, getProperty, listClientDocuments, listingForClient, listMedia, userCanViewProperty } from "@/lib/queries";
import { isShareToken } from "@/lib/share";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string; id: string }>;
}) {
  const { token, id } = await params;
  const storedClient = isShareToken(token) ? await findClientByShareToken(token) : null;
  const client = storedClient ? await clientAsCreatorSees(storedClient) : null;
  const storedProperty = client ? await getProperty(id) : null;
  const allowed = Boolean(client && storedProperty && (await userCanViewProperty(client.id, storedProperty.id)));
  const property = allowed && client && storedProperty ? await listingForClient(client, storedProperty) : storedProperty;
  return {
    title: allowed && property ? `${property.address} · Aitch NYC` : "Listing · Aitch NYC",
    robots: { index: false, follow: false },
  };
}

export default async function ClientListingPage({
  params,
}: {
  params: Promise<{ token: string; id: string }>;
}) {
  const { token, id } = await params;
  if (!isShareToken(token)) notFound();
  const storedClient = await findClientByShareToken(token);
  if (!storedClient) notFound();
  const client = await clientAsCreatorSees(storedClient);
  const storedProperty = await getProperty(id);
  if (!storedProperty || !(await userCanViewProperty(client.id, storedProperty.id))) notFound();
  const property = await listingForClient(client, storedProperty);
  const [media, interest, documents] = await Promise.all([
    listMedia(id),
    getListingInterest(client.id, property.id),
    listClientDocuments([client.id]),
  ]);

  return (
    <div className="min-h-screen w-full min-w-0 max-w-full overflow-x-clip bg-white text-black">
      <ClientHeader href={`/c/${token}`} />
      <ListingDetail
        property={property}
        media={media}
        backHref={`/c/${token}`}
        mediaBase={`/api/c/${token}/media`}
        mapHref={`/c/${token}/listings/${property.id}`}
        documents={documents
          .filter((document) => document.property_id === property.id)
          .map((document) => ({ href: `/api/c/${token}/documents/${document.id}`, name: document.original_name }))}
        like={
          <ListingInterest
            propertyId={property.id}
            name={formatAddress(property.address, property.unit)}
            liked={interest.liked}
            tourRequested={interest.tourRequested}
            tourScheduledAt={interest.tourScheduledAt}
            likeEndpoint={`/api/c/${token}/likes`}
            tourEndpoint={`/api/c/${token}/tours`}
            detail={formatPrice(property.price_cents, property.listing_type)}
          />
        }
      />
    </div>
  );
}
