import { withDefaultCity } from "@/lib/address";
import { parseAmenities } from "@/lib/amenities";
import type { ListingStatus, ListingType, PropertyInput } from "@/lib/types";

const SALE_STATUSES: ListingStatus[] = ["active", "pending", "sold"];
const RENTAL_STATUSES: ListingStatus[] = ["active", "pending", "rented"];
const COMMERCIAL_STATUSES: ListingStatus[] = ["active", "inactive"];

export function statusesFor(listingType: ListingType): ListingStatus[] {
  if (listingType === "rental") return RENTAL_STATUSES;
  if (listingType === "commercial") return COMMERCIAL_STATUSES;
  return SALE_STATUSES;
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

function optionalCents(value: unknown, label: string): number | null | string {
  const raw = asString(value).replace(/[$,\s]/g, "");
  if (!raw) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return `Enter ${label} in dollars.`;
  const [dollars, fraction = ""] = raw.split(".");
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > 100_000_000_000) return `${label} is too large.`;
  return cents;
}

function textField(value: unknown, label: string, max: number): string | { error: string } {
  const text = asString(value);
  if (text.length > max) return { error: `${label} is too long.` };
  return text;
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

  const commercial = listingType === "commercial";
  const priceText = asString(input.price).trim();
  const priceRaw = priceText.replace(/[$,\s]/g, "");
  let priceCents = 0;
  const rentUponRequest = commercial && (priceRaw === "" || priceRaw === "0" || /^uponrequest$/i.test(priceRaw));
  if (!rentUponRequest) {
    if (!/^\d+(\.\d{1,2})?$/.test(priceRaw)) {
      return { error: commercial ? "Enter an asking rent in dollars." : "Enter a price in dollars." };
    }
    const [dollars, fraction = ""] = priceRaw.split(".");
    priceCents = Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));
    if (priceCents <= 0) {
      return { error: commercial ? "Asking rent must be greater than zero." : "Price must be greater than zero." };
    }
  }

  let keyMoney: number | null = null;
  if (commercial) {
    const parsedKeyMoney = optionalCents(input.keyMoney, "Key money");
    if (typeof parsedKeyMoney === "string") return { error: parsedKeyMoney };
    keyMoney = parsedKeyMoney;
  }

  const neighborhood = asString(input.neighborhood);
  if (neighborhood.length > 120) return { error: "Neighborhood is too long." };

  const sqft = optionalInt(input.sqft, commercial ? "Sqft - Ground" : "Square footage");
  if (typeof sqft === "string") return { error: sqft };

  let sqftOptional: number | null = null;
  if (commercial) {
    const parsedSqft = optionalInt(input.sqftOptional, "Total Sqft");
    if (typeof parsedSqft === "string") return { error: parsedSqft };
    sqftOptional = parsedSqft;
  }

  let bedrooms: number | null = null;
  let bathrooms: number | null = null;
  if (!commercial) {
    const parsedBedrooms = optionalInt(input.bedrooms, "Bedrooms");
    if (typeof parsedBedrooms === "string") return { error: parsedBedrooms };
    bedrooms = parsedBedrooms;

    const bathsRaw = asString(input.bathrooms);
    if (bathsRaw) {
      if (!/^\d+(\.\d)?$/.test(bathsRaw)) {
        return { error: "Bathrooms must be a number, like 1 or 1.5." };
      }
      bathrooms = Number(bathsRaw);
      if (bathrooms > 100) return { error: "Bathrooms is too large." };
    }
  }

  const status = asString(input.status) as ListingStatus;
  if (!statusesFor(listingType).includes(status)) {
    return { error: "Choose a status that matches the listing type." };
  }

  const description = asString(input.description);
  if (description.length > 8000) {
    return { error: commercial ? "Comments are too long." : "Description is too long." };
  }

  let possession = "";
  let terms = "";
  let frontage = "";
  let ceilingHeight = "";
  let neighboringTenants = "";
  if (commercial) {
    const parsedPossession = textField(input.possession, "Possession", 200);
    if (typeof parsedPossession !== "string") return parsedPossession;
    const parsedTerms = textField(input.terms, "Terms", 200);
    if (typeof parsedTerms !== "string") return parsedTerms;
    const parsedFrontage = textField(input.frontage, "Frontage", 80);
    if (typeof parsedFrontage !== "string") return parsedFrontage;
    const parsedCeiling = textField(input.ceilingHeight, "Ceiling height", 80);
    if (typeof parsedCeiling !== "string") return parsedCeiling;
    const parsedTenants = textField(input.neighboringTenants, "Neighboring tenants", 8000);
    if (typeof parsedTenants !== "string") return parsedTenants;
    possession = parsedPossession;
    terms = parsedTerms;
    frontage = parsedFrontage;
    ceilingHeight = parsedCeiling;
    neighboringTenants = parsedTenants;
  }

  return {
    address,
    unit: unit || null,
    price_cents: priceCents,
    listing_type: listingType,
    neighborhood,
    sqft,
    sqft_optional: commercial ? sqftOptional : null,
    bedrooms: commercial ? null : bedrooms,
    bathrooms: commercial ? null : bathrooms,
    amenities: commercial ? parseAmenities(null) : parseAmenities(input.amenities),
    description,
    status: commercial ? "active" : status,
    is_inactive: commercial && status === "inactive" ? 1 : 0,
    key_money_cents: commercial ? keyMoney : null,
    possession: commercial ? possession : "",
    terms: commercial ? terms : "",
    frontage: commercial ? frontage : "",
    ceiling_height: commercial ? ceilingHeight : "",
    neighboring_tenants: commercial ? neighboringTenants : "",
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
    return { error: "Enter a valid email." };
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
