import { withDefaultCity } from "@/lib/address";
import { parseAmenities } from "@/lib/amenities";
import type { ListingStatus, ListingType, PropertyInput } from "@/lib/types";

const SALE_STATUSES: ListingStatus[] = ["active", "pending", "sold"];
const RENTAL_STATUSES: ListingStatus[] = ["active", "pending", "rented"];

export function statusesFor(listingType: ListingType): ListingStatus[] {
  return listingType === "rental" ? RENTAL_STATUSES : SALE_STATUSES;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalInt(value: unknown, label: string): number | null | string {
  const raw = asString(value);
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return `${label} must be a whole number.`;
  const number = Number(raw);
  if (number > 100000) return `${label} is too large.`;
  return number;
}

export function parsePropertyInput(body: unknown): PropertyInput | { error: string } {
  if (!body || typeof body !== "object") return { error: "Missing listing details." };
  const input = body as Record<string, unknown>;

  const address = withDefaultCity(asString(input.address));
  if (!address) return { error: "Address is required." };
  if (address.length > 300) return { error: "Address is too long." };

  const unit = asString(input.unit);
  if (unit.length > 40) return { error: "Unit number is too long." };

  const listingType = asString(input.listingType);
  if (listingType !== "sale" && listingType !== "rental" && listingType !== "commercial") {
    return { error: "Choose rental, sale, or commercial." };
  }

  const priceRaw = asString(input.price).replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(priceRaw)) {
    return { error: "Enter a price in dollars." };
  }
  const [dollars, fraction = ""] = priceRaw.split(".");
  const priceCents = Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));
  if (priceCents <= 0) return { error: "Price must be greater than zero." };

  const neighborhood = asString(input.neighborhood);
  if (neighborhood.length > 120) return { error: "Neighborhood is too long." };

  const sqft = optionalInt(input.sqft, "Square footage");
  if (typeof sqft === "string") return { error: sqft };
  const bedrooms = optionalInt(input.bedrooms, "Bedrooms");
  if (typeof bedrooms === "string") return { error: bedrooms };

  const bathsRaw = asString(input.bathrooms);
  let bathrooms: number | null = null;
  if (bathsRaw) {
    if (!/^\d+(\.\d)?$/.test(bathsRaw)) {
      return { error: "Bathrooms must be a number, like 1 or 1.5." };
    }
    bathrooms = Number(bathsRaw);
    if (bathrooms > 100) return { error: "Bathrooms is too large." };
  }

  const status = asString(input.status) as ListingStatus;
  if (!statusesFor(listingType).includes(status)) {
    return { error: "Choose a status that matches the listing type." };
  }

  const description = asString(input.description);
  if (description.length > 8000) return { error: "Description is too long." };

  return {
    address,
    unit: unit || null,
    price_cents: priceCents,
    listing_type: listingType,
    neighborhood,
    sqft,
    bedrooms,
    bathrooms,
    amenities: parseAmenities(input.amenities),
    description,
    status,
  };
}

export function parseClientInput(body: unknown): { name: string; email: string } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Missing client details." };
  const input = body as Record<string, unknown>;
  const name = asString(input.name);
  const email = asString(input.email).toLowerCase();
  if (!name) return { error: "Name is required." };
  if (name.length > 120) return { error: "Name is too long." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email. Clients sign in with this Google account." };
  }
  return { name, email };
}

export function parseAssignmentIds(body: unknown): string[] | { error: string } {
  if (!body || typeof body !== "object") return { error: "Missing assignments." };
  const ids = (body as { propertyIds?: unknown }).propertyIds;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
    return { error: "Choose listings to assign." };
  }
  return [...new Set(ids)];
}
