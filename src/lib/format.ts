import { amenityLabels, parseAmenities } from "@/lib/amenities";
import type { Locale } from "@/lib/locale";
import { localeTag } from "@/lib/locale";
import { translate } from "@/lib/messages";
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

export function formatMoney(cents: number, locale: Locale = "en") {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat(localeTag(locale), {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}

export function formatPrice(cents: number, listingType: ListingType, locale: Locale = "en") {
  if (listingType === "commercial" && cents <= 0) return translate(locale, "price.uponRequest");
  const money = formatMoney(cents, locale);
  return listingType === "rental" ? translate(locale, "price.perMonth", { money }) : money;
}

export function dollarsInputValue(cents: number) {
  if (cents % 100 === 0) return String(cents / 100);
  return (cents / 100).toFixed(2);
}

export function listingTypeLabel(listingType: ListingType, locale: Locale = "en") {
  if (listingType === "rental" || listingType === "sale" || listingType === "commercial") {
    return translate(locale, `type.${listingType}`);
  }
  return translate(locale, "type.sale");
}

export const LISTING_STATUSES: ListingStatus[] = ["active", "leased", "pending", "inactive"];

export function displayStatus(property: {
  status: string;
  is_inactive?: number | null;
}): ListingStatus {
  if (property.is_inactive) return "inactive";
  if (property.status === "leased" || property.status === "rented" || property.status === "sold") return "leased";
  if (property.status === "pending") return "pending";
  if (property.status === "inactive") return "inactive";
  return "active";
}

export function statusLabel(status: ListingStatus, locale: Locale = "en") {
  return translate(locale, `status.${status}`);
}

export function statusTone(status: ListingStatus) {
  switch (status) {
    case "active":
      return "border-green-700 bg-green-700 text-white";
    case "leased":
      return "border-sky-900 bg-sky-900 text-white";
    case "pending":
      return "border-amber-500 bg-amber-400 text-amber-950";
    case "inactive":
      return "border-neutral-300 bg-neutral-200 text-neutral-600";
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

const KO_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function formatTourWhen(value: string, locale: Locale = "en") {
  const match = TOUR_WHEN.exec(value);
  if (!match) return value;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour24 = Number(match[4]);
  const minute = match[5];
  const weekday = new Date(year, month - 1, day).getDay();
  const hour12 = hour24 % 12 || 12;
  if (locale === "ko") {
    const suffix = hour24 < 12 ? "오전" : "오후";
    return `${year}년 ${month}월 ${day}일 (${KO_WEEKDAYS[weekday]}) ${suffix} ${hour12}:${minute}`;
  }
  const suffix = hour24 < 12 ? "AM" : "PM";
  return `${TOUR_WEEKDAYS[weekday]}, ${TOUR_MONTHS[month - 1]} ${day}, ${year} · ${hour12}:${minute} ${suffix}`;
}

export function formatAddress(address: string, unit: string | null) {
  if (!unit) return address;
  return `${address}, ${unit}`;
}

export function formatFacts(
  property: {
    listing_type?: ListingType;
    bedrooms: number | null;
    bathrooms: number | null;
    sqft: number | null;
    sqft_optional?: number | null;
    amenities: string;
  },
  locale: Locale = "en",
) {
  const parts: string[] = [];
  const number = (value: number) => value.toLocaleString(localeTag(locale));
  if (property.listing_type === "commercial") {
    if (property.sqft != null) {
      parts.push(translate(locale, "facts.sqftGround", { count: number(property.sqft) }));
    }
    if (property.sqft_optional != null) {
      parts.push(translate(locale, "facts.sqftTotal", { count: number(property.sqft_optional) }));
    }
    return parts.join(" · ");
  }
  if (property.bedrooms != null) {
    parts.push(translate(locale, "facts.bedrooms", { count: property.bedrooms }));
  }
  if (property.bathrooms != null) {
    parts.push(translate(locale, "facts.bathrooms", { count: property.bathrooms }));
  }
  if (property.sqft != null) {
    parts.push(translate(locale, "facts.sqft", { count: number(property.sqft) }));
  }
  parts.push(...amenityLabels(parseAmenities(property.amenities), locale));
  return parts.join(" · ");
}
