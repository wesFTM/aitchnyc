import { PropertyForm } from "@/components/PropertyForm";

export const metadata = { title: "New listing · Aitch NYC" };

export default function NewPropertyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">New listing</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Save the address first. A street address is placed in New York, NY. Photos are added on the next screen.
        </p>
      </div>
      <PropertyForm />
    </div>
  );
}
