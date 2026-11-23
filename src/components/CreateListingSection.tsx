"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ImportListing } from "@/components/ImportListing";
import { LoopNetImport } from "@/components/LoopNetImport";
import { PropertyForm } from "@/components/PropertyForm";
import { StreetEasyImport } from "@/components/StreetEasyImport";

export function CreateListingSection() {
  const [open, setOpen] = useState(false);

  return (
    <section className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-neutral-800">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="text-lg font-semibold">Create Listing</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-neutral-500 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open && (
        <div className="space-y-6 border-t border-neutral-800 px-4 py-5 sm:px-5">
          <div className="grid min-w-0 items-stretch gap-4 md:grid-cols-3">
            <StreetEasyImport />
            <LoopNetImport />
            <ImportListing />
          </div>
          <section className="w-full min-w-0 max-w-full rounded-2xl border border-neutral-200 p-5">
            <h3 className="text-lg font-semibold">Create New Listing</h3>
            <p className="mt-1 mb-5 text-sm text-neutral-500">Select listing type to start.</p>
            <PropertyForm />
          </section>
        </div>
      )}
    </section>
  );
}
