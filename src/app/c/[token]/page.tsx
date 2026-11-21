import { notFound } from "next/navigation";
import { ClientHeader } from "@/components/ClientHeader";
import { ClientListingsBoard } from "@/components/ClientListingsBoard";
import { clientLogoUrl } from "@/lib/client-logo";
import { listingPdfSources, pdfFilename } from "@/lib/listing-pdf-source";
import { findClientByShareToken, listImageIdsForProperties, listPropertiesForUser } from "@/lib/queries";
import { isShareToken } from "@/lib/share";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = isShareToken(token) ? await findClientByShareToken(token) : null;
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
  const client = await findClientByShareToken(token);
  if (!client) notFound();
  const properties = await listPropertiesForUser(client.id);
  const images = await listImageIdsForProperties(properties.map((property) => property.id));
  const pdfs = listingPdfSources(properties, images, (id) => `/api/c/${token}/media/${id}`);
  const items = properties.map((property, index) => ({
    property,
    href: `/c/${token}/listings/${property.id}`,
    coverSrc: property.cover_id ? `/api/c/${token}/media/${property.cover_id}` : null,
    pdf: pdfs[index],
  }));

  return (
    <div className="min-h-screen min-w-0 overflow-x-clip bg-white text-black">
      <ClientHeader href={`/c/${token}`} />
      <main className="mx-auto min-w-0 max-w-6xl space-y-6 px-4 py-8">
        <ClientListingsBoard
          name={client.name}
          logoSrc={clientLogoUrl(client.share_token, client.logo_key)}
          items={items}
          filename={pdfFilename(client.name)}
        />
      </main>
    </div>
  );
}
