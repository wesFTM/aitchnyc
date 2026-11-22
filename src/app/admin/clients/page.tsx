import { ClientCard, NewClientForm } from "@/components/ClientsManager";
import { listAssignments, listClients, listLikes, listProperties } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Clients · Aitch NYC" };

export default async function ClientsPage() {
  const [clients, properties, assignments, likes] = await Promise.all([
    listClients(),
    listProperties(),
    listAssignments(),
    listLikes(),
  ]);
  const byClient = new Map<string, string[]>();
  for (const row of assignments) {
    const current = byClient.get(row.user_id) ?? [];
    current.push(row.property_id);
    byClient.set(row.user_id, current);
  }
  const likesByClient = new Map<string, string[]>();
  const toursByClient = new Map<string, string[]>();
  const schedulesByClient = new Map<string, Record<string, string>>();
  for (const row of likes) {
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
      <div>
        <h1 className="text-3xl font-semibold">Clients</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">
          Add a client with their name and phone number. Email is optional. Their page is created right away. Checked listings show up on that page, and the link is ready to copy and send. Likes and tour requests show up at the top of their card. After a tour is requested, set a date and time to mark it scheduled.
        </p>
      </div>
      <NewClientForm />
      {clients.length === 0 ? (
        <p className="text-sm text-neutral-500">No clients yet.</p>
      ) : (
        <div className="grid gap-4">
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              properties={properties}
              assignedIds={byClient.get(client.id) ?? []}
              likedIds={likesByClient.get(client.id) ?? []}
              tourIds={toursByClient.get(client.id) ?? []}
              tourSchedules={schedulesByClient.get(client.id) ?? {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}
