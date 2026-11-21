import { notFound } from "next/navigation";
import { ClientHeader } from "@/components/ClientHeader";
import { ListingDetail } from "@/components/ListingDetail";
import { findClientByShareToken, getProperty, listMedia, userCanViewProperty } from "@/lib/queries";
import { isShareToken } from "@/lib/share";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string; id: string }>;
}) {
  const { token, id } = await params;
  const client = isShareToken(token) ? await findClientByShareToken(token) : null;
  const property = client ? await getProperty(id) : null;
  const allowed = client && property && (await userCanViewProperty(client.id, property.id));
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
  const client = await findClientByShareToken(token);
  if (!client) notFound();
  const property = await getProperty(id);
  if (!property || !(await userCanViewProperty(client.id, property.id))) notFound();
  const media = await listMedia(id);

  return (
    <div className="min-h-screen min-w-0 overflow-x-clip bg-white text-black">
      <ClientHeader href={`/c/${token}`} />
      <ListingDetail
        property={property}
        media={media}
        backHref={`/c/${token}`}
        mediaBase={`/api/c/${token}/media`}
        mapHref={`/c/${token}/listings/${property.id}`}
      />
    </div>
  );
}
