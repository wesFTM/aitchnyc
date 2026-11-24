import { redirect } from "next/navigation";
import { AdminCard, NewAdminForm, type AdminRecord, type ClientChoice, type ListingChoice } from "@/components/AdminsManager";
import { getCurrentUser } from "@/lib/auth";
import { listAdminClientGrants, listAdminListingGrants, listAdmins, listClients, listProperties } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admins · Aitch NYC" };

export default async function AdminsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "super_admin") redirect("/admin");

  const [admins, properties, clients, listingGrants, clientGrants] = await Promise.all([
    listAdmins(),
    listProperties(),
    listClients(),
    listAdminListingGrants(),
    listAdminClientGrants(),
  ]);

  const listings: ListingChoice[] = properties.map((property) => ({
    id: property.id,
    address: property.address,
    unit: property.unit,
    neighborhood: property.neighborhood,
    listingType: property.listing_type,
  }));
  const clientChoices: ClientChoice[] = clients.map((client) => ({
    id: client.id,
    name: client.name,
    email: client.email,
  }));
  const listingsByAdmin = new Map<string, string[]>();
  for (const row of listingGrants) {
    const current = listingsByAdmin.get(row.user_id) ?? [];
    current.push(row.property_id);
    listingsByAdmin.set(row.user_id, current);
  }
  const clientsByAdmin = new Map<string, string[]>();
  for (const row of clientGrants) {
    const current = clientsByAdmin.get(row.user_id) ?? [];
    current.push(row.client_id);
    clientsByAdmin.set(row.user_id, current);
  }
  const records: AdminRecord[] = admins.map((admin) => ({
    id: admin.id,
    email: admin.email,
    name: admin.name,
    signedInAt: admin.signed_in_at,
    propertyIds: listingsByAdmin.get(admin.id) ?? [],
    clientIds: clientsByAdmin.get(admin.id) ?? [],
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Admins</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">
          Super admins see every listing and client. An admin only sees the listings and clients you allow, on their own dashboard. Add them by the email they use with Google, then edit that email or their access at any time.
        </p>
      </div>
      <NewAdminForm listings={listings} clients={clientChoices} />
      {records.length === 0 ? (
        <p className="text-sm text-neutral-500">No admins yet.</p>
      ) : (
        <div className="grid gap-4">
          {records.map((admin) => (
            <AdminCard key={admin.id} admin={admin} listings={listings} clients={clientChoices} />
          ))}
        </div>
      )}
    </div>
  );
}
