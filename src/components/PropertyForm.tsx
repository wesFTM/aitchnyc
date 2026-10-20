"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AMENITY_FIELDS, emptyAmenities, parseAmenities } from "@/lib/amenities";
import { sendJson } from "@/lib/client-api";
import { LISTING_TYPE_OPTIONS, dollarsInputValue, statusLabel } from "@/lib/format";
import { NEIGHBORHOODS, buttonClass, fieldClass, labelClass, secondaryButtonClass } from "@/lib/styles";
import type { ListingStatus, ListingType, Property } from "@/lib/types";
import { statusesFor } from "@/lib/validators";

type Props = {
  property?: Property;
};

const empty = {
  address: "",
  unit: "",
  price: "",
  listingType: "sale" as ListingType,
  neighborhood: "",
  sqft: "",
  bedrooms: "",
  bathrooms: "",
  amenities: emptyAmenities(),
  description: "",
  status: "active" as ListingStatus,
};

export function PropertyForm({ property }: Props) {
  const router = useRouter();
  const [values, setValues] = useState(() =>
    property
      ? {
          address: property.address,
          unit: property.unit || "",
          price: dollarsInputValue(property.price_cents),
          listingType: property.listing_type,
          neighborhood: property.neighborhood,
          sqft: property.sqft?.toString() || "",
          bedrooms: property.bedrooms?.toString() || "",
          bathrooms: property.bathrooms?.toString() || "",
          amenities: parseAmenities(property.amenities),
          description: property.description,
          status: property.status,
        }
      : empty,
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function update<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function changeType(listingType: ListingType) {
    const allowed = statusesFor(listingType);
    setValues((current) => ({
      ...current,
      listingType,
      status: allowed.includes(current.status) ? current.status : "active",
    }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const payload = { ...values };
      if (property) {
        const result = await sendJson<{ geocoded: boolean }>(`/api/properties/${property.id}`, "PATCH", payload);
        setNotice(
          result.geocoded
            ? "Saved."
            : "Saved. This address is not on the map yet. Check the street address, then save again.",
        );
        router.refresh();
      } else {
        const result = await sendJson<{ id: string; geocoded: boolean }>("/api/properties", "POST", payload);
        router.push(result.geocoded ? `/admin/properties/${result.id}` : `/admin/properties/${result.id}?placed=0`);
        router.refresh();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this listing.");
    } finally {
      setPending(false);
    }
  }

  async function onDelete() {
    if (!property) return;
    if (!window.confirm("Delete this listing, including its photos and video?")) return;
    setPending(true);
    setError(null);
    try {
      await sendJson(`/api/properties/${property.id}`, "DELETE");
      router.push("/admin");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete this listing.");
      setPending(false);
    }
  }

  const statuses = statusesFor(values.listingType);

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {LISTING_TYPE_OPTIONS.map((type) => (
          <label
            key={type.id}
            className={`cursor-pointer rounded-xl border px-2 py-3 text-center text-sm font-semibold ${
              values.listingType === type.id ? "border-black" : "border-neutral-300"
            }`}
          >
            <input
              className="sr-only"
              type="radio"
              name="listingType"
              checked={values.listingType === type.id}
              onChange={() => changeType(type.id)}
            />
            {type.label}
          </label>
        ))}
      </div>

      <label className="block">
        <span className={labelClass}>Address</span>
        <input
          className={fieldClass}
          value={values.address}
          onChange={(event) => update("address", event.target.value)}
          placeholder="538 E 14th St"
          required
        />
        <span className="mt-1 block text-xs text-neutral-500">
          A street address is saved and mapped in New York, NY.
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Unit #</span>
          <input className={fieldClass} value={values.unit} onChange={(event) => update("unit", event.target.value)} />
        </label>
        <label className="block">
          <span className={labelClass}>{values.listingType === "rental" ? "Monthly rent" : "Price"}</span>
          <input
            className={fieldClass}
            inputMode="decimal"
            value={values.price}
            onChange={(event) => update("price", event.target.value)}
            placeholder={values.listingType === "rental" ? "4500" : "1250000"}
            required
          />
        </label>
        <label className="block">
          <span className={labelClass}>Neighborhood</span>
          <input
            className={fieldClass}
            list="neighborhoods"
            value={values.neighborhood}
            onChange={(event) => update("neighborhood", event.target.value)}
          />
          <datalist id="neighborhoods">
            {NEIGHBORHOODS.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className={labelClass}>Status</span>
          <select
            className={fieldClass}
            value={values.status}
            onChange={(event) => update("status", event.target.value as ListingStatus)}
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Square footage</span>
          <input
            className={fieldClass}
            inputMode="numeric"
            value={values.sqft}
            onChange={(event) => update("sqft", event.target.value)}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Bedrooms</span>
          <input
            className={fieldClass}
            inputMode="numeric"
            value={values.bedrooms}
            onChange={(event) => update("bedrooms", event.target.value)}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Bathrooms</span>
          <input
            className={fieldClass}
            inputMode="decimal"
            value={values.bathrooms}
            onChange={(event) => update("bathrooms", event.target.value)}
          />
        </label>
      </div>

      <fieldset>
        <legend className={labelClass}>Amenities</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {AMENITY_FIELDS.map((field) => (
            <label key={field.key} className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 accent-black"
                checked={values.amenities[field.key]}
                onChange={(event) =>
                  update("amenities", { ...values.amenities, [field.key]: event.target.checked })
                }
              />
              {field.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className={labelClass}>Description</span>
        <textarea
          className={`${fieldClass} min-h-32`}
          value={values.description}
          onChange={(event) => update("description", event.target.value)}
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-neutral-700">{notice}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Saving…" : property ? "Save listing" : "Create listing"}
        </button>
        {property && (
          <button className={secondaryButtonClass} type="button" onClick={onDelete} disabled={pending}>
            Delete listing
          </button>
        )}
      </div>
    </form>
  );
}
