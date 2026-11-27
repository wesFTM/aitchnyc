import { redirect } from "next/navigation";
import { T } from "@/components/T";
import { ImportListing } from "@/components/ImportListing";
import { StreetEasyImport } from "@/components/StreetEasyImport";
import { PropertyForm } from "@/components/PropertyForm";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "New listing · Aitch NYC" };

export default async function NewPropertyPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "super_admin" && user.role !== "admin")) redirect("/admin");
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <T as="h1" className="text-3xl font-semibold" id="admin.newListing" />
        <p className="mt-1 text-sm text-neutral-500">
          <T id="admin.newListingHelp" />
          {user.role === "admin" && <T id="admin.newListingAdmin" />}
        </p>
      </div>
      <StreetEasyImport />
      <ImportListing />
      <PropertyForm />
    </div>
  );
}
