import { amenityLabels, parseAmenities } from "@/lib/amenities";
import type { ListingStatus, ListingType } from "@/lib/types";

export const LISTING_TYPE_OPTIONS: { id: ListingType; label: string }[] = [
  { id: "rental", label: "Rental" },
  { id: "sale", label: "Sale" },
  { id: "commercial", label: "Commercial" },
];

export const LISTING_COLORS: Record<ListingType, string> = {
  rental: "#2563EB",
  sale: "#171717",
  commercial: "#C2410C",
};

export const LIKED_PIN_COLOR = "#16a34a";

export function formatMoney(cents: number) {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}

export function formatPrice(cents: number, listingType: ListingType) {
  if (listingType === "commercial" && cents <= 0) return "Upon request";
  const money = formatMoney(cents);
  return listingType === "rental" ? `${money}/mo` : money;
}

export function dollarsInputValue(cents: number) {
  if (cents % 100 === 0) return String(cents / 100);
  return (cents / 100).toFixed(2);
}

export function listingTypeLabel(listingType: ListingType) {
  return LISTING_TYPE_OPTIONS.find((option) => option.id === listingType)?.label ?? "Sale";
}

export function displayStatus(property: {
  listing_type: ListingType;
  status: ListingStatus;
  is_inactive?: number | null;
}): ListingStatus {
  if (property.listing_type === "commercial") return property.is_inactive ? "inactive" : "active";
  return property.status;
}

export function statusLabel(status: ListingStatus) {
  switch (status) {
    case "active":
      return "Active";
    case "pending":
      return "Pending";
    case "rented":
      return "Rented";
    case "sold":
      return "Sold";
    case "inactive":
      return "Inactive";
  }
}

const TOUR_WHEN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function normalizeTourDateTime(value: string) {
  const match = TOUR_WHEN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (hour > 23 || minute > 59) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}`;
}

const TOUR_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TOUR_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatTourWhen(value: string) {
  const match = TOUR_WHEN.exec(value);
  if (!match) return value;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour24 = Number(match[4]);
  const minute = match[5];
  const weekday = new Date(year, month - 1, day).getDay();
  const hour12 = hour24 % 12 || 12;
  const suffix = hour24 < 12 ? "AM" : "PM";
  return `${TOUR_WEEKDAYS[weekday]}, ${TOUR_MONTHS[month - 1]} ${day}, ${year} · ${hour12}:${minute} ${suffix}`;
}

export function formatAddress(address: string, unit: string | null) {
  if (!unit) return address;
  return `${address}, ${unit}`;
}

export function formatFacts(property: {
  listing_type?: ListingType;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  sqft_optional?: number | null;
  amenities: string;
}) {
  const parts: string[] = [];
  if (property.listing_type === "commercial") {
    if (property.sqft != null) {
      parts.push(`${property.sqft.toLocaleString("en-US")} sf ground`);
    }
    if (property.sqft_optional != null) {
      parts.push(`${property.sqft_optional.toLocaleString("en-US")} sf total`);
    }
    return parts.join(" · ");
  }
  if (property.bedrooms != null) {
    parts.push(`${property.bedrooms} bd`);
  }
  if (property.bathrooms != null) {
    parts.push(`${property.bathrooms} ba`);
  }
  if (property.sqft != null) {
    parts.push(`${property.sqft.toLocaleString("en-US")} sf`);
  }
  parts.push(...amenityLabels(parseAmenities(property.amenities)));
  return parts.join(" · ");
}
