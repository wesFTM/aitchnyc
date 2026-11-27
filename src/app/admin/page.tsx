import Link from "next/link";
import { CreateListingSection } from "@/components/CreateListingSection";
import { DashboardDeals, type ListingOption, type PersonOption } from "@/components/DealsManager";
import { T } from "@/components/T";
import { SavedListings } from "@/components/SavedListings";
import { PrintListingsButton } from "@/components/ListingPdfActions";
import { PropertyMapLoader } from "@/components/PropertyMapLoader";
import { getCurrentUser } from "@/lib/auth";
import { presentDeal } from "@/lib/deal-view";
import { formatAddress } from "@/lib/format";
import {
  listClients,
  listClientsForAdmin,
  listDealDocuments,
  listDealsForDashboard,
  listProperties,
  listPropertiesForAdmin,
  listStaff,
} from "@/lib/queries";
import type { User } from "@/lib/types";

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
  const dealBoard = !showHidden && user && (superAdmin || user.role === "admin") ? await loadDealBoard(user) : null;
  const hrefBase = superAdmin ? "/admin/properties" : "/properties";
  const pins = properties
    .filter((property) => property.lat != null && property.lng != null)
    .map((property) => ({
      id: property.id,
      lat: property.lat as number,
      lng: property.lng as number,
      title: formatAddress(property.address, property.unit),
      detail: "",
      priceCents: property.price_cents,
      href: `${hrefBase}/${property.id}`,
      listingType: property.listing_type,
    }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <T
            as="h1"
            className="text-3xl font-semibold"
            id={showHidden ? "admin.hiddenListings" : "admin.dashboard"}
          />
          <p className="mt-1 max-w-2xl text-sm text-neutral-500">
            {showHidden ? (
              <T id="admin.hiddenListingsBody" />
            ) : properties.length === 0 ? (
              <T id={superAdmin ? "admin.emptySuper" : "admin.emptyAdmin"} />
            ) : (
              <T
                id={superAdmin ? "admin.summarySuper" : "admin.summaryAdmin"}
                values={{ count: properties.length, pins: pins.length }}
              />
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {superAdmin && (
            <Link href={showHidden ? "/admin" : "/admin?hidden=1"} className="text-sm font-semibold underline">
              <T id={showHidden ? "admin.backToMaster" : "admin.hiddenListings"} />
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

      {!showHidden && <CreateListingSection />}
      {dealBoard && (
        <DashboardDeals
          deals={dealBoard.deals}
          clients={dealBoard.clients}
          listings={dealBoard.listings}
          agents={dealBoard.agents}
        />
      )}

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

async function loadDealBoard(user: User) {
  const superAdmin = user.role === "super_admin";
  const [clients, properties, staff, deals] = await Promise.all([
    superAdmin ? listClients() : listClientsForAdmin(user.id),
    superAdmin ? listProperties() : listPropertiesForAdmin(user.id),
    listStaff(),
    listDealsForDashboard(user),
  ]);
  const documents = await listDealDocuments(deals.map((deal) => deal.id));
  const documentsByDeal = new Map<string, typeof documents>();
  for (const document of documents) {
    const current = documentsByDeal.get(document.deal_id) ?? [];
    current.push(document);
    documentsByDeal.set(document.deal_id, current);
  }
  const clientOptions: PersonOption[] = clients.map((client) => ({ id: client.id, label: client.name }));
  const listingOptions: ListingOption[] = properties.map((property) => ({
    id: property.id,
    address: property.address,
    unit: property.unit,
  }));
  const agentOptions: PersonOption[] = staff.map((person) => ({
    id: person.id,
    label: person.name.trim() || person.email,
  }));
  return {
    clients: clientOptions,
    listings: listingOptions,
    agents: agentOptions,
    deals: deals.map((deal) =>
      presentDeal(deal, documentsByDeal.get(deal.id) ?? [], (id) => `/api/deals/${deal.id}/documents/${id}`, true),
    ),
  };
}
