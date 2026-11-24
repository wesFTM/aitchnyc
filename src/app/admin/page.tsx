import Link from "next/link";
import { AdminRoster } from "@/components/AdminsManager";
import { CreateListingSection } from "@/components/CreateListingSection";
import { SavedListings } from "@/components/SavedListings";
import { PrintListingsButton } from "@/components/ListingPdfActions";
import { PropertyMapLoader } from "@/components/PropertyMapLoader";
import { getCurrentUser } from "@/lib/auth";
import { formatAddress, formatPrice } from "@/lib/format";
import {
  listAdminClientGrants,
  listAdminListingGrants,
  listAdmins,
  listClients,
  listProperties,
  listPropertiesForAdmin,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard · Aitch NYC" };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ hidden?: string }> }) {
  const user = await getCurrentUser();
  const { hidden } = await searchParams;
  const superAdmin = user?.role === "super_admin";
  const showHidden = Boolean(superAdmin && hidden === "1");
  const properties = superAdmin || !user
    ? await listProperties({ hidden: showHidden })
    : await listPropertiesForAdmin(user.id);
  const hrefBase = superAdmin ? "/admin/properties" : "/properties";
  const [admins, listingGrants, clientGrants, clients] = superAdmin
    ? await Promise.all([listAdmins(), listAdminListingGrants(), listAdminClientGrants(), listClients()])
    : [[], [], [], []];
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
  const pins = properties
    .filter((property) => property.lat != null && property.lng != null)
    .map((property) => ({
      id: property.id,
      lat: property.lat as number,
      lng: property.lng as number,
      title: formatAddress(property.address, property.unit),
      detail: formatPrice(property.price_cents, property.listing_type),
      href: `${hrefBase}/${property.id}`,
      listingType: property.listing_type,
    }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">{showHidden ? "Hidden listings" : "Dashboard"}</h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-500">
            {showHidden
              ? "Hidden listings are off the master list and off every admin list. Restoring one puts it back on the master list only."
              : properties.length === 0
                ? superAdmin
                  ? "Add an address to put it on the map."
                  : "Listings you add are published to the master list with your name. A super admin can hide or delete one, which takes it off your list too."
                : superAdmin
                  ? `${properties.length} on the master list · ${pins.length} on the map`
                  : `${properties.length} on your list · ${pins.length} on the map. Edits you make stay on your list and your clients' pages.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {superAdmin && (
            <Link href={showHidden ? "/admin" : "/admin?hidden=1"} className="text-sm font-semibold underline">
              {showHidden ? "Back to the master list" : "Hidden listings"}
            </Link>
          )}
          <PrintListingsButton
            properties={properties.map((property) => ({
              id: property.id,
              label: formatAddress(property.address, property.unit),
            }))}
          />
        </div>
      </div>

      {superAdmin && (
        <AdminRoster
          admins={admins.map((admin) => ({
            id: admin.id,
            email: admin.email,
            name: admin.name,
            signedInAt: admin.signed_in_at,
            propertyIds: listingsByAdmin.get(admin.id) ?? [],
            clientIds: clientsByAdmin.get(admin.id) ?? [],
          }))}
          clients={clients.map((client) => ({ id: client.id, name: client.name, email: client.email }))}
        />
      )}

      {!showHidden && <CreateListingSection />}

      {!showHidden && (
        <div className="h-[420px] w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-neutral-200">
          <PropertyMapLoader pins={pins} />
        </div>
      )}

      {properties.length > 0 && (
        <SavedListings
          properties={properties}
          editableStatus={superAdmin}
          hrefBase={hrefBase}
          editorId={superAdmin ? null : user?.id}
          canHide={superAdmin}
          canRemove={!superAdmin}
        />
      )}
    </div>
  );
}
