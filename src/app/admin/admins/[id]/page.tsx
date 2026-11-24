import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminAvatar } from "@/components/AdminsManager";
import { SavedListings } from "@/components/SavedListings";
import { getCurrentUser } from "@/lib/auth";
import { findUserById, listClientsForAdmin, listPropertiesForAdmin } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await findUserById(id);
  return { title: admin?.role === "admin" ? `${admin.name} · Admin` : "Admin" };
}

export default async function AdminViewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "super_admin") redirect("/admin");
  const { id } = await params;
  const admin = await findUserById(id);
  if (!admin || admin.role !== "admin") notFound();
  const [properties, clients] = await Promise.all([
    listPropertiesForAdmin(admin.id),
    listClientsForAdmin(admin.id),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/admins" className="text-sm font-semibold underline">
          Back to admins
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <AdminAvatar id={admin.id} name={admin.name} email={admin.email} avatarKey={admin.logo_key} size={72} />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Admin page</p>
          <h1 className="truncate text-3xl font-semibold">{admin.name}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {admin.email} · {clients.length} {clients.length === 1 ? "client" : "clients"} · {properties.length}{" "}
            {properties.length === 1 ? "listing" : "listings"}
          </p>
        </div>
      </div>
      <p className="max-w-2xl text-sm text-neutral-500">
        This is the dashboard {admin.name} sees, including edits they made after adding a listing or client.
      </p>
      {properties.length === 0 ? (
        <p className="text-sm text-neutral-500">No listings on this admin&apos;s list.</p>
      ) : (
        <SavedListings properties={properties} editableStatus={false} hrefBase="/properties" />
      )}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Clients</h2>
        {clients.length === 0 ? (
          <p className="text-sm text-neutral-500">No clients on this admin&apos;s list.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-800">
            {clients.map((client) => (
              <li key={client.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
                <span className="font-medium">{client.name}</span>
                <span className="text-sm text-neutral-500">
                  {client.created_by === admin.id ? "Added by this admin" : "Assigned from the master list"}
                  {client.flagged ? " · Flagged" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
