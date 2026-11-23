"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { ImportListing } from "@/components/ImportListing";
import { LoopNetImport } from "@/components/LoopNetImport";
import { PropertyForm } from "@/components/PropertyForm";
import { StreetEasyImport } from "@/components/StreetEasyImport";

export function CreateListingSection() {
  const [open, setOpen] = useState(false);

  return (
    <section className="w-full min-w-0 max-w-full rounded-2xl border border-neutral-800 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Create Listing</h2>
        <button
          type="button"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black text-black"
          aria-expanded={open}
          aria-label={open ? "Close create listing form" : "Open create listing form"}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <Minus className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
        </button>
      </div>
      {open && (
        <div className="mt-5 space-y-6">
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
