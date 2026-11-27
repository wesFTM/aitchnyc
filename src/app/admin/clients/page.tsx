import Link from "next/link";
import { T } from "@/components/T";
import { ClientCard, NewClientForm } from "@/components/ClientsManager";
import { getCurrentUser } from "@/lib/auth";
import { formatAddress } from "@/lib/format";
import {
  assignmentIdsForAdminView,
  listAssignments,
  listClientDocuments,
  listStreetNumberHides,
  listClients,
  listClientsForAdmin,
  listLikes,
  listProperties,
  listPropertiesForAdmin,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Clients · Aitch NYC" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ hidden?: string }> }) {
  const user = await getCurrentUser();
  const { hidden } = await searchParams;
  const superAdmin = user?.role === "super_admin";
  const showHidden = Boolean(superAdmin && hidden === "1");
  const [clients, properties, assignments, likes, streetNumberHides] = await Promise.all([
    superAdmin || !user ? listClients({ hidden: showHidden }) : listClientsForAdmin(user.id),
    superAdmin || !user ? listProperties() : listPropertiesForAdmin(user.id),
    listAssignments(),
    listLikes(),
    superAdmin ? listStreetNumberHides() : Promise.resolve([]),
  ]);
  const clientDocuments = await listClientDocuments(clients.map((client) => client.id));
  const visibleProperties = new Set(properties.map((property) => property.id));
  const byClient = new Map<string, string[]>();
  for (const row of assignments) {
    if (!superAdmin && !visibleProperties.has(row.property_id)) continue;
    const current = byClient.get(row.user_id) ?? [];
    current.push(row.property_id);
    byClient.set(row.user_id, current);
  }
  if (!superAdmin && user) {
    for (const client of clients) {
      const ids = await assignmentIdsForAdminView(user.id, client, byClient.get(client.id) ?? []);
      byClient.set(
        client.id,
        ids.filter((id) => visibleProperties.has(id)),
      );
    }
  }
  const documentsByClient = new Map<string, { id: string; propertyId: string; name: string; label: string }[]>();
  for (const document of clientDocuments) {
    const current = documentsByClient.get(document.client_id) ?? [];
    current.push({
      id: document.id,
      propertyId: document.property_id,
      name: document.original_name,
      label: formatAddress(document.address, document.unit),
    });
    documentsByClient.set(document.client_id, current);
  }
  const hiddenNumbersByClient = new Map<string, string[]>();
  for (const row of streetNumberHides) {
    const current = hiddenNumbersByClient.get(row.user_id) ?? [];
    current.push(row.property_id);
    hiddenNumbersByClient.set(row.user_id, current);
  }
  const likesByClient = new Map<string, string[]>();
  const toursByClient = new Map<string, string[]>();
  const schedulesByClient = new Map<string, Record<string, string>>();
  for (const row of likes) {
    if (!superAdmin && !visibleProperties.has(row.property_id)) continue;
    const current = likesByClient.get(row.user_id) ?? [];
    current.push(row.property_id);
    likesByClient.set(row.user_id, current);
    if (!row.tour_requested) continue;
    const tours = toursByClient.get(row.user_id) ?? [];
    tours.push(row.property_id);
    toursByClient.set(row.user_id, tours);
    if (!row.tour_scheduled_at) continue;
    const schedules = schedulesByClient.get(row.user_id) ?? {};
    schedules[row.property_id] = row.tour_scheduled_at;
    schedulesByClient.set(row.user_id, schedules);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <T as="h1" className="text-3xl font-semibold" id={showHidden ? "admin.hiddenClients" : "admin.clients"} />
          <p className="mt-1 max-w-2xl text-sm text-neutral-500">
            <T
              id={showHidden ? "admin.hiddenClientsBody" : superAdmin ? "admin.clientsSuper" : "admin.clientsAdmin"}
            />
          </p>
        </div>
        {superAdmin && (
          <Link href={showHidden ? "/admin/clients" : "/admin/clients?hidden=1"} className="text-sm font-semibold underline">
            <T id={showHidden ? "admin.backToMaster" : "admin.hiddenClients"} />
          </Link>
        )}
      </div>
      {!showHidden && <NewClientForm />}
      {clients.length === 0 ? (
        <T as="p" className="text-sm text-neutral-500" id={showHidden ? "admin.noHiddenClients" : "admin.noClients"} />
      ) : (
        <div className="grid gap-4">
          {clients.map((client) => {
            const ownsClient = Boolean(user && client.created_by === user.id);
            return (
              <ClientCard
                key={client.id}
                client={client}
                properties={properties}
                assignedIds={byClient.get(client.id) ?? []}
                hiddenStreetNumberIds={hiddenNumbersByClient.get(client.id) ?? []}
                likedIds={likesByClient.get(client.id) ?? []}
                tourIds={toursByClient.get(client.id) ?? []}
                tourSchedules={schedulesByClient.get(client.id) ?? {}}
                documents={documentsByClient.get(client.id) ?? []}
                readOnly={!superAdmin && !ownsClient}
                allowDelete={superAdmin}
                allowRemove={!superAdmin}
                showFlag={superAdmin}
                showHide={superAdmin}
                editorId={superAdmin ? null : user?.id}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
