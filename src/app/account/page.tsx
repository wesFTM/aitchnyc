import { redirect } from "next/navigation";
import { AppBar } from "@/components/AppBar";
import { DownloadPdfButton } from "@/components/ListingPdfActions";
import { ListingCard } from "@/components/ListingCard";
import { getCurrentUser } from "@/lib/auth";
import { listingPdfSources, pdfFilename } from "@/lib/listing-pdf-source";
import { listImageIdsForProperties, listPropertiesForUser } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your listings · Aitch NYC",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  if (user.role === "super_admin") redirect("/admin");
  const properties = await listPropertiesForUser(user.id);
  const images = await listImageIdsForProperties(properties.map((property) => property.id));
  const listings = listingPdfSources(properties, images, (id) => `/api/media/${id}`);

  return (
    <div className="min-h-screen min-w-0 overflow-x-clip bg-white text-black">
      <AppBar user={user} />
      <main className="mx-auto min-w-0 max-w-6xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="break-words text-3xl font-semibold">Your listings</h1>
            <p className="mt-1 text-sm text-neutral-500">Prepared for {user.name}.</p>
          </div>
          <DownloadPdfButton listings={listings} filename={pdfFilename(user.name)} />
        </div>
        {properties.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 p-6 text-sm text-neutral-600">
            Nothing here yet. When your agent adds a property for you, it will show up on this page.
          </div>
        ) : (
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((property) => (
              <ListingCard key={property.id} property={property} href={`/properties/${property.id}`} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
