import Link from "next/link";
import type { ListingType } from "@/lib/types";

export function listingFilter(value: string | undefined): "all" | ListingType {
  if (value === "rental" || value === "sale" || value === "commercial") return value;
  return "all";
}

const OPTIONS: { id: "all" | ListingType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "rental", label: "Rentals" },
  { id: "sale", label: "Sales" },
  { id: "commercial", label: "Commercial" },
];

export function ListingTypeFilter({
  basePath,
  current,
  counts,
}: {
  basePath: string;
  current: "all" | ListingType;
  counts: Record<"all" | ListingType, number>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Show</span>
      {OPTIONS.map((option) => {
        const active = current === option.id;
        const href = option.id === "all" ? basePath : `${basePath}?type=${option.id}`;
        return (
          <Link
            key={option.id}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "inline-flex items-center gap-2 rounded-full bg-black px-3 py-1.5 text-sm font-medium text-white"
                : "inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-black hover:border-black"
            }
          >
            {option.label}
            <span className={active ? "text-xs text-white/70" : "text-xs text-neutral-400"}>{counts[option.id]}</span>
          </Link>
        );
      })}
    </div>
  );
}
