import { redirect } from "next/navigation";
import { AppBar } from "@/components/AppBar";
import { ClientListingsBoard } from "@/components/ClientListingsBoard";
import { getCurrentUser } from "@/lib/auth";
import { clientLogoUrl } from "@/lib/client-logo";
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
  const pdfs = listingPdfSources(properties, images, (id) => `/api/media/${id}`);
  const items = properties.map((property, index) => ({
    property,
    href: `/properties/${property.id}`,
    coverSrc: property.cover_id ? `/api/media/${property.cover_id}` : null,
    pdf: pdfs[index],
  }));

  return (
    <div className="min-h-screen min-w-0 overflow-x-clip bg-white text-black">
      <AppBar user={user} />
      <main className="mx-auto min-w-0 max-w-6xl space-y-6 px-4 py-8">
        <ClientListingsBoard
          name={user.name}
          logoSrc={clientLogoUrl(user.share_token, user.logo_key)}
          items={items}
          filename={pdfFilename(user.name)}
        />
      </main>
    </div>
  );
}
