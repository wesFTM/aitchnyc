import { withDefaultCity } from "@/lib/address";
import { parseAmenities } from "@/lib/amenities";
import { normalizeTourDateTime } from "@/lib/format";
import type { ClientInput, DealInput, DealSide, DealType, FeePayer, ListingStatus, PropertyInput } from "@/lib/types";

const LISTING_STATUS_VALUES: ListingStatus[] = ["active", "leased", "pending", "inactive"];

export function parseListingStatus(value: unknown): ListingStatus | { error: string } {
  const raw = asString(value).toLowerCase();
  if (raw === "rented" || raw === "sold") return "leased";
  if (LISTING_STATUS_VALUES.includes(raw as ListingStatus)) return raw as ListingStatus;
  return { error: "Choose Active, Leased, Pending, or Inactive." };
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
    keyMoney = parsedKeyMoney ?? 0;
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

  const status = parseListingStatus(input.status);
  if (typeof status !== "string") return status;

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
    status,
    is_inactive: status === "inactive" ? 1 : 0,
    key_money_cents: commercial ? keyMoney : null,
    possession: commercial ? possession : "",
    terms: commercial ? terms : "",
    frontage: commercial ? frontage : "",
    ceiling_height: commercial ? ceilingHeight : "",
    neighboring_tenants: commercial ? neighboringTenants : "",
  };
}

export function normalizeWebsite(value: unknown): string | { error: string } {
  const text = asString(value);
  if (!text) return "";
  if (text.length > 300) return { error: "Company website is too long." };
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return { error: "Enter a valid company website." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { error: "Company website needs to start with http:// or https://." };
  }
  if (!url.hostname.includes(".")) return { error: "Enter a valid company website." };
  url.hash = "";
  return url.toString();
}

export function parseClientInput(body: unknown): ClientInput | { error: string } {
  if (!body || typeof body !== "object") return { error: "Missing client details." };
  const input = body as Record<string, unknown>;
  const name = asString(input.name);
  const email = asString(input.email).toLowerCase();
  const phone = asString(input.phone);
  if (!name) return { error: "Name is required." };
  if (name.length > 120) return { error: "Name is too long." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email." };
  }
  if (phone.length > 40) return { error: "Phone number is too long." };
  if (phone && !/^[0-9+().\-\s]+$/.test(phone)) {
    return { error: "Enter a valid phone number." };
  }
  const companyWebsite = normalizeWebsite(input.companyWebsite ?? input.company_website);
  if (typeof companyWebsite !== "string") return companyWebsite;
  const companyZip = asString(input.companyZip ?? input.company_zip);
  if (companyZip && !/^\d{5}(-\d{4})?$/.test(companyZip)) {
    return { error: "Enter a 5-digit company zip code." };
  }
  return { name, email, phone, companyWebsite, companyZip };
}

export function parseLike(body: unknown): { propertyId: string; liked: boolean } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Missing listing." };
  const input = body as { propertyId?: unknown; liked?: unknown };
  if (typeof input.propertyId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.propertyId)) {
    return { error: "Choose a listing." };
  }
  if (typeof input.liked !== "boolean") return { error: "Choose whether to like this listing." };
  return { propertyId: input.propertyId, liked: input.liked };
}

export function parseTour(body: unknown): { propertyId: string; requested: boolean } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Missing listing." };
  const input = body as { propertyId?: unknown; requested?: unknown };
  if (typeof input.propertyId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.propertyId)) {
    return { error: "Choose a listing." };
  }
  if (typeof input.requested !== "boolean") return { error: "Choose whether to request a tour of this listing." };
  return { propertyId: input.propertyId, requested: input.requested };
}

export function parseTourSchedule(body: unknown): { propertyId: string; scheduledAt: string | null } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Missing listing." };
  const input = body as { propertyId?: unknown; scheduledAt?: unknown };
  if (typeof input.propertyId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.propertyId)) {
    return { error: "Choose a listing." };
  }
  if (input.scheduledAt === null) return { propertyId: input.propertyId, scheduledAt: null };
  if (typeof input.scheduledAt !== "string") return { error: "Enter a date and time for the tour." };
  const scheduledAt = normalizeTourDateTime(input.scheduledAt);
  if (!scheduledAt) return { error: "Enter a date and time for the tour." };
  return { propertyId: input.propertyId, scheduledAt };
}

const RECORD_ID = /^[0-9a-f-]{36}$/i;

function idList(value: unknown, message: string): string[] | { error: string } {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((id) => typeof id !== "string" || !RECORD_ID.test(id))) {
    return { error: message };
  }
  return [...new Set(value as string[])];
}

export function parseAdminAccount(
  body: unknown,
): { email: string; name: string; propertyIds: string[]; clientIds: string[]; updateAccess: boolean } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Missing admin details." };
  const input = body as Record<string, unknown>;
  const email = asString(input.email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email." };
  let name = asString(input.name);
  if (name.length > 120) return { error: "Name is too long." };
  if (!name) name = email.split("@")[0] || "Admin";
  const updateAccess = Array.isArray(input.propertyIds) || Array.isArray(input.clientIds);
  const propertyIds = updateAccess ? idList(input.propertyIds, "Choose the listings this admin can see.") : [];
  if ("error" in propertyIds) return propertyIds;
  const clientIds = updateAccess ? idList(input.clientIds, "Choose the clients this admin can see.") : [];
  if ("error" in clientIds) return clientIds;
  return { email, name, propertyIds, clientIds, updateAccess };
}

const DEAL_TYPES: DealType[] = ["referral_residential", "sale_residential", "rental_commercial", "sale_commercial"];
const DEAL_SIDES: DealSide[] = ["tenant", "landlord", "both"];
const FEE_PAYERS: FeePayer[] = ["tenant", "landlord", "other"];

function optionalDate(value: unknown, label: string): string | null | { error: string } {
  const raw = asString(value);
  if (!raw) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return { error: `${label} needs a valid date.` };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return { error: `${label} needs a valid date.` };
  }
  return raw;
}

export function parseDealInput(body: unknown): DealInput | { error: string } {
  if (!body || typeof body !== "object") return { error: "Missing deal details." };
  const input = body as Record<string, unknown>;

  const clientId = asString(input.clientId);
  if (!RECORD_ID.test(clientId)) return { error: "Choose a client." };

  const propertyRaw = asString(input.propertyId);
  if (propertyRaw && !RECORD_ID.test(propertyRaw)) return { error: "Choose a listing." };

  const address = asString(input.address);
  if (!address) return { error: "Address is required." };
  if (address.length > 300) return { error: "Address is too long." };

  const unit = textField(input.unit, "Unit", 40);
  if (typeof unit !== "string") return unit;
  const city = textField(input.city, "City", 80);
  if (typeof city !== "string") return city;
  const state = asString(input.state).toUpperCase();
  if (state && !/^[A-Z]{2}$/.test(state)) return { error: "State needs two letters." };
  const zip = asString(input.zip);
  if (zip && !/^\d{5}(?:-\d{4})?$/.test(zip)) return { error: "Zip needs 5 digits." };

  const dealType = asString(input.dealType);
  if (!DEAL_TYPES.includes(dealType as DealType)) return { error: "Choose a type of deal." };
  const represented = asString(input.represented);
  if (!DEAL_SIDES.includes(represented as DealSide)) return { error: "Choose who we represented." };
  const feePayer = asString(input.feePayer);
  if (!FEE_PAYERS.includes(feePayer as FeePayer)) return { error: "Choose who pays our fee." };

  const rent = optionalCents(input.monthlyRent, "Monthly rent");
  if (typeof rent === "string") return { error: rent };
  if (rent === 0) return { error: "Monthly rent must be greater than zero." };

  const leaseStart = optionalDate(input.leaseStart, "Lease start");
  if (leaseStart && typeof leaseStart !== "string") return leaseStart;
  const leaseEnd = optionalDate(input.leaseEnd, "Lease end");
  if (leaseEnd && typeof leaseEnd !== "string") return leaseEnd;
  if (leaseStart && leaseEnd && leaseEnd < leaseStart) {
    return { error: "Lease end needs to be on or after the start date." };
  }

  const advertised = asString(input.publiclyAdvertised).toLowerCase();
  if (advertised !== "yes" && advertised !== "no") {
    return { error: "Say whether the listing was publicly advertised." };
  }

  const leadSource = textField(input.leadSource, "Lead source", 200);
  if (typeof leadSource !== "string") return leadSource;
  const feeNote = textField(input.feePayerNote, "Who pays", 200);
  if (typeof feeNote !== "string") return feeNote;

  const leadAgentId = asString(input.leadAgentId);
  if (!RECORD_ID.test(leadAgentId)) return { error: "Choose a lead agent." };

  return {
    clientId,
    propertyId: propertyRaw || null,
    address,
    unit,
    city,
    state,
    zip,
    dealType: dealType as DealType,
    represented: represented as DealSide,
    monthlyRentCents: rent,
    leaseStart,
    leaseEnd,
    feePayer: feePayer as FeePayer,
    feePayerNote: feePayer === "other" ? feeNote : "",
    publiclyAdvertised: advertised === "yes",
    leadSource,
    leadAgentId,
  };
}

export function parseAssignmentIds(body: unknown): string[] | { error: string } {
  if (!body || typeof body !== "object") return { error: "Missing assignments." };
  const ids = (body as { propertyIds?: unknown }).propertyIds;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
    return { error: "Choose listings to assign." };
  }
  return [...new Set(ids)];
}
