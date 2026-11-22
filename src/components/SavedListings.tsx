"use client";

import { useState } from "react";
import { ListingCard } from "@/components/ListingCard";
import type { ListingType, PropertyListItem } from "@/lib/types";

type Filter = "all" | ListingType;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "rental", label: "Rental" },
  { id: "sale", label: "Sales" },
  { id: "commercial", label: "Commercial" },
];

export function SavedListings({ properties }: { properties: PropertyListItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const visible = filter === "all" ? properties : properties.filter((property) => property.listing_type === filter);
  const selected = FILTERS.find((option) => option.id === filter) ?? FILTERS[0];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Current Listings</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter saved listings">
          {FILTERS.map((option) => {
            const active = filter === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(option.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  active ? "border-black bg-black text-white" : "border-neutral-300 bg-white text-black"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-neutral-500">No {selected.label.toLowerCase()} listings saved.</p>
      ) : (
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          {visible.map((property) => (
            <ListingCard key={property.id} property={property} href={`/admin/properties/${property.id}`} />
          ))}
        </div>
      )}
    </section>
  );
}
