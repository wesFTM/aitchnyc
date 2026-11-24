import { redirect } from "next/navigation";
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
        <h1 className="text-3xl font-semibold">New listing</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Save the address first. A street address is placed in New York, NY. Photos are added on the next screen.
          {user.role === "admin" &&
            " This listing is added to the master list with your name, and it is also added to your list."}
        </p>
      </div>
      <StreetEasyImport />
      <ImportListing />
      <PropertyForm />
    </div>
  );
}
