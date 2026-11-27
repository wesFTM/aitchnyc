import { redirect } from "next/navigation";
import { AppBar } from "@/components/AppBar";
import { ClientListingsBoard } from "@/components/ClientListingsBoard";
import { getCurrentUser } from "@/lib/auth";
import { clientLogoUrl } from "@/lib/client-logo";
import { documentLinksByProperty } from "@/lib/documents";
import { listingPdfSources, pdfFilename } from "@/lib/listing-pdf-source";
import { presentClientDeal } from "@/lib/deal-view";
import { listClientDocuments, listClientInterest, listDealDocuments, listDealsForClient, listImageIdsForProperties, listPropertiesForUser } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Current Listings · Aitch NYC",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  if (user.role === "super_admin" || user.role === "admin") redirect("/admin");
  const properties = await listPropertiesForUser(user.id);
  const [images, interest, documents, dealRows] = await Promise.all([
    listImageIdsForProperties(properties.map((property) => property.id)),
    listClientInterest(user.id),
    listClientDocuments([user.id]),
    listDealsForClient(user.id),
  ]);
  const dealDocuments = await listDealDocuments(dealRows.map((deal) => deal.id));
  const dealDocumentsByDeal = new Map<string, typeof dealDocuments>();
  for (const document of dealDocuments) {
    const current = dealDocumentsByDeal.get(document.deal_id) ?? [];
    current.push(document);
    dealDocumentsByDeal.set(document.deal_id, current);
  }
  const currentDeals = dealRows.map((deal) =>
    presentClientDeal(deal, dealDocumentsByDeal.get(deal.id) ?? [], (id) => `/api/deals/documents/${id}`),
  );
  const pdfs = listingPdfSources(properties, images, (id) => `/api/media/${id}`);
  const documentsByProperty = documentLinksByProperty(documents, (id) => `/api/documents/${id}`);
  const items = properties.map((property, index) => ({
    property,
    href: `/properties/${property.id}`,
    coverSrc: property.cover_id ? `/api/media/${property.cover_id}` : null,
    pdf: pdfs[index],
    documents: documentsByProperty.get(property.id) ?? [],
  }));

  return (
    <div className="min-h-screen w-full min-w-0 max-w-full overflow-x-clip bg-white text-black">
      <AppBar user={user} />
      <main className="mx-auto w-full min-w-0 max-w-6xl space-y-6 px-4 py-8">
        <ClientListingsBoard
          name={user.name}
          logoSrc={clientLogoUrl(user.share_token, user.logo_key)}
          items={items}
          filename={pdfFilename(user.name)}
          likeEndpoint="/api/likes"
          tourEndpoint="/api/tours"
          likedIds={interest.likedIds}
          tourIds={interest.tourIds}
          tourSchedules={interest.tourSchedules}
          currentDeals={currentDeals}
        />
      </main>
    </div>
  );
}
