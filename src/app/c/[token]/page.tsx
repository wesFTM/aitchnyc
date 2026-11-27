import { notFound } from "next/navigation";
import { ClientHeader } from "@/components/ClientHeader";
import { ClientListingsBoard } from "@/components/ClientListingsBoard";
import { clientLogoUrl } from "@/lib/client-logo";
import { documentLinksByProperty } from "@/lib/documents";
import { listingPdfSources, pdfFilename } from "@/lib/listing-pdf-source";
import { presentClientDeal } from "@/lib/deal-view";
import { clientAsCreatorSees, findClientByShareToken, listClientDocuments, listClientInterest, listDealDocuments, listDealsForClient, listImageIdsForProperties, listPropertiesForUser } from "@/lib/queries";
import { isShareToken } from "@/lib/share";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const stored = isShareToken(token) ? await findClientByShareToken(token) : null;
  const client = stored ? await clientAsCreatorSees(stored) : null;
  return {
    title: client ? `${client.name} · Aitch NYC` : "Listings · Aitch NYC",
    robots: { index: false, follow: false },
  };
}

export default async function ClientListingsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!isShareToken(token)) notFound();
  const stored = await findClientByShareToken(token);
  if (!stored) notFound();
  const client = await clientAsCreatorSees(stored);
  const properties = await listPropertiesForUser(client.id);
  const [images, interest, documents, dealRows] = await Promise.all([
    listImageIdsForProperties(properties.map((property) => property.id)),
    listClientInterest(client.id),
    listClientDocuments([client.id]),
    listDealsForClient(client.id),
  ]);
  const dealDocuments = await listDealDocuments(dealRows.map((deal) => deal.id));
  const dealDocumentsByDeal = new Map<string, typeof dealDocuments>();
  for (const document of dealDocuments) {
    const current = dealDocumentsByDeal.get(document.deal_id) ?? [];
    current.push(document);
    dealDocumentsByDeal.set(document.deal_id, current);
  }
  const currentDeals = dealRows.map((deal) =>
    presentClientDeal(deal, dealDocumentsByDeal.get(deal.id) ?? [], (id) => `/api/c/${token}/deals/documents/${id}`),
  );
  const pdfs = listingPdfSources(properties, images, (id) => `/api/c/${token}/media/${id}`);
  const documentsByProperty = documentLinksByProperty(documents, (id) => `/api/c/${token}/documents/${id}`);
  const items = properties.map((property, index) => ({
    property,
    href: `/c/${token}/listings/${property.id}`,
    coverSrc: property.cover_id ? `/api/c/${token}/media/${property.cover_id}` : null,
    pdf: pdfs[index],
    documents: documentsByProperty.get(property.id) ?? [],
  }));

  return (
    <div className="min-h-screen w-full min-w-0 max-w-full overflow-x-clip bg-white text-black">
      <ClientHeader href={`/c/${token}`} />
      <main className="mx-auto w-full min-w-0 max-w-6xl space-y-6 px-4 py-8">
        <ClientListingsBoard
          name={client.name}
          logoSrc={clientLogoUrl(client.share_token, client.logo_key)}
          items={items}
          filename={pdfFilename(client.name)}
          likeEndpoint={`/api/c/${token}/likes`}
          tourEndpoint={`/api/c/${token}/tours`}
          likedIds={interest.likedIds}
          tourIds={interest.tourIds}
          tourSchedules={interest.tourSchedules}
          currentDeals={currentDeals}
        />
      </main>
    </div>
  );
}
