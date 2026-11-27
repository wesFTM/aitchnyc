import { redirect } from "next/navigation";
import { T } from "@/components/T";
import { DealList, NewDealForm, type ListingOption, type PersonOption } from "@/components/DealsManager";
import { getCurrentUser } from "@/lib/auth";
import { presentDeal } from "@/lib/deal-view";
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

export const metadata = { title: "Deals · Aitch NYC" };

function personLabel(person: User) {
  return person.name.trim() || person.email;
}

export default async function DealsPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "super_admin" && user.role !== "admin")) redirect("/login?next=/admin/deals");
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
  const agentOptions: PersonOption[] = staff.map((person) => ({ id: person.id, label: personLabel(person) }));
  const items = deals.map((deal) =>
    presentDeal(deal, documentsByDeal.get(deal.id) ?? [], (id) => `/api/deals/${deal.id}/documents/${id}`, true),
  );

  return (
    <div className="space-y-8">
      <div>
        <T as="h1" className="text-3xl font-semibold" id="deals.title" />
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">
          <T id={superAdmin ? "deals.superBody" : "deals.adminBody"} />
        </p>
      </div>
      <NewDealForm clients={clientOptions} listings={listingOptions} agents={agentOptions} currentUserId={user.id} />
      <DealList deals={items} clients={clientOptions} listings={listingOptions} agents={agentOptions} />
    </div>
  );
}
