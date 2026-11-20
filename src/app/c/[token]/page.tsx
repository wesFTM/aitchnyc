import { notFound } from "next/navigation";
import { ClientHeader } from "@/components/ClientHeader";
import { DownloadPdfButton } from "@/components/ListingPdfActions";
import { ListingCard } from "@/components/ListingCard";
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

export default async function ClientListingsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isShareToken(token)) notFound();
  const client = await findClientByShareToken(token);
  if (!client) notFound();
  const properties = await listPropertiesForUser(client.id);
  const images = await listImageIdsForProperties(properties.map((property) => property.id));
  const listings = listingPdfSources(
    properties,
    images,
    (id) => `/api/c/${token}/media/${id}`,
  );

  return (
    <div className="min-h-screen bg-white text-black">
      <ClientHeader href={`/c/${token}`} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Your listings</h1>
            <p className="mt-1 text-sm text-neutral-500">Prepared for {client.name}.</p>
          </div>
          <DownloadPdfButton listings={listings} filename={pdfFilename(client.name)} />
        </div>
        {properties.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 p-6 text-sm text-neutral-600">
            Nothing here yet. When your agent adds a property for you, it will show up on this page.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((property) => (
              <ListingCard
                key={property.id}
                property={property}
                href={`/c/${token}/listings/${property.id}`}
                coverSrc={property.cover_id ? `/api/c/${token}/media/${property.cover_id}` : null}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
