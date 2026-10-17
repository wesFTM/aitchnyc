import { ClientCard, NewClientForm } from "@/components/ClientsManager";
import { listAssignments, listClients, listProperties } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Clients · Aitch NYC" };

export default async function ClientsPage() {
  const [clients, properties, assignments] = await Promise.all([
    listClients(),
    listProperties(),
    listAssignments(),
  ]);
  const byClient = new Map<string, string[]>();
  for (const row of assignments) {
    const current = byClient.get(row.user_id) ?? [];
    current.push(row.property_id);
    byClient.set(row.user_id, current);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Clients</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">
          Invite someone with the Gmail they will use to sign in. Checked listings show up on their page.
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
