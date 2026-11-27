"use client";

import { useState } from "react";
import { useI18n } from "@/components/LanguageProvider";
import { ListingCard } from "@/components/ListingCard";
import { HideRecordButton, RemoveFromMyListButton } from "@/components/MasterListActions";
import type { ListingType, PropertyListItem } from "@/lib/types";

type Filter = "all" | ListingType;

const FILTERS: Filter[] = ["all", "rental", "sale", "commercial"];

export function SavedListings({
  properties,
  editableStatus = true,
  hrefBase = "/admin/properties",
  editorId = null,
  canHide = false,
  canRemove = false,
}: {
  properties: PropertyListItem[];
  editableStatus?: boolean;
  hrefBase?: string;
  editorId?: string | null;
  canHide?: boolean;
  canRemove?: boolean;
}) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<Filter>("all");
  const visible = filter === "all" ? properties : properties.filter((property) => property.listing_type === filter);
  const emptyLabel = {
    all: t("saved.noneAll"),
    rental: t("saved.noneRental"),
    sale: t("saved.noneSale"),
    commercial: t("saved.noneCommercial"),
  }[filter];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("saved.current")}</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("saved.filter")}>
          {FILTERS.map((option) => {
            const active = filter === option;
            const label = {
              all: t("listings.all"),
              rental: t("type.rental"),
              sale: t("type.sales"),
              commercial: t("type.commercial"),
            }[option];
            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(option)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  active ? "border-black bg-black text-white" : "border-neutral-300 bg-white text-black"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-neutral-500">{emptyLabel}</p>
      ) : (
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          {visible.map((property) => {
            const ownListing = Boolean(editorId && property.created_by === editorId);
            const href = ownListing ? `/admin/properties/${property.id}` : `${hrefBase}/${property.id}`;
            const actions = canHide || canRemove;
            return (
              <ListingCard
                key={property.id}
                property={property}
                href={href}
                editableStatus={editableStatus || ownListing}
                note={property.created_by_name ? t("listings.addedBy", { name: property.created_by_name }) : null}
                footer={
                  actions ? (
                    <div className="flex flex-wrap gap-2">
                      {canHide && <HideRecordButton kind="listing" id={property.id} hidden={Boolean(property.hidden)} />}
                      {canRemove && <RemoveFromMyListButton kind="listing" id={property.id} />}
                    </div>
                  ) : undefined
                }
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
