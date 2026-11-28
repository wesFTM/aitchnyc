import { amenityLabels, parseAmenities } from "@/lib/amenities";
import type { Locale } from "@/lib/locale";
import { localeTag } from "@/lib/locale";
import { translate, type MessageKey } from "@/lib/messages";
import type { DealSide, DealStatus, DealType, FeePayer, ListingStatus, ListingType } from "@/lib/types";

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

export function moneyToCents(value: string): number | null | "invalid" {
  const raw = value.replace(/[$,\s]/g, "");
  if (!raw) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return "invalid";
  const [dollars, fraction = ""] = raw.split(".");
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > 100_000_000_000) return "invalid";
  return cents;
}

export function percentToBps(value: string): number | null | "invalid" {
  const raw = value.trim().replace(/%/g, "");
  if (!raw) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return "invalid";
  const [whole, fraction = ""] = raw.split(".");
  const bps = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(bps) || bps > 10_000) return "invalid";
  return bps;
}

export function bpsInputValue(bps: number) {
  if (bps % 100 === 0) return String(bps / 100);
  if (bps % 10 === 0) return (bps / 100).toFixed(1);
  return (bps / 100).toFixed(2);
}

export type RevenueMonth = {
  key: string;
  cents: Record<DealStatus, number>;
  totalCents: number;
  count: number;
};

const EMPTY_STATUS_CENTS = (): Record<DealStatus, number> => ({
  in_process: 0,
  closed: 0,
  complete: 0,
});

function shiftMonth(key: string, delta: number) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthDistance(start: string, end: string) {
  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  return (endYear - startYear) * 12 + (endMonth - startMonth);
}

export function revenueMonthLabel(key: string, locale: Locale, withYear: boolean) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(localeTag(locale), {
    month: "short",
    year: withYear ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function monthlyNetRevenue(
  deals: {
    closeDate: string | null;
    status: DealStatus;
    grossCommissionCents: number | null;
    companySplitBps: number | null;
    referralFeeCents: number | null;
  }[],
) {
  const buckets = new Map<string, RevenueMonth>();
  let unscheduledCount = 0;
  let unscheduledCents = 0;

  for (const deal of deals) {
    const net = commissionMath(deal.grossCommissionCents, deal.companySplitBps, deal.referralFeeCents).netCents ?? 0;
    const key = deal.closeDate?.slice(0, 7) ?? "";
    if (!/^\d{4}-\d{2}$/.test(key)) {
      unscheduledCount += 1;
      unscheduledCents += net;
      continue;
    }
    const bucket = buckets.get(key) ?? { key, cents: EMPTY_STATUS_CENTS(), totalCents: 0, count: 0 };
    bucket.cents[deal.status] += net;
    bucket.totalCents += net;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  const keys = [...buckets.keys()].sort();
  if (keys.length >= 2 && monthDistance(keys[0], keys[keys.length - 1]) <= 18) {
    for (let key = keys[0]; key <= keys[keys.length - 1]; key = shiftMonth(key, 1)) {
      if (!buckets.has(key)) buckets.set(key, { key, cents: EMPTY_STATUS_CENTS(), totalCents: 0, count: 0 });
    }
  }

  return {
    months: [...buckets.values()].sort((left, right) => left.key.localeCompare(right.key)),
    unscheduledCount,
    unscheduledCents,
  };
}

export function commissionMath(
  grossCents: number | null,
  splitBps: number | null,
  referralCents: number | null,
) {
  const split = splitBps ?? 0;
  const referral = referralCents ?? 0;
  if (grossCents == null) {
    return { grossCents: null, splitBps: split, splitCents: 0, referralCents: referral, netCents: null };
  }
  const splitCents = Math.round((grossCents * split) / 10_000);
  return {
    grossCents,
    splitBps: split,
    splitCents,
    referralCents: referral,
    netCents: grossCents - splitCents - referral,
  };
}

export const DEAL_TYPES: DealType[] = [
  "referral_residential",
  "sale_residential",
  "rental_commercial",
  "sale_commercial",
];

export const DEAL_SIDES: DealSide[] = ["tenant", "landlord", "both"];

export const FEE_PAYERS: FeePayer[] = ["tenant", "landlord", "other"];

export const DEAL_STATUSES: DealStatus[] = ["in_process", "closed", "complete"];

const DEAL_STATUS_KEY: Record<DealStatus, MessageKey> = {
  in_process: "deals.status.in_process",
  closed: "deals.status.closed",
  complete: "deals.status.complete",
};

export function dealStatusLabel(status: string, locale: Locale = "en") {
  if (status in DEAL_STATUS_KEY) return translate(locale, DEAL_STATUS_KEY[status as DealStatus]);
  return status;
}

export function dealStatusTone(status: DealStatus) {
  switch (status) {
    case "in_process":
      return "border-amber-500 bg-amber-400 text-amber-950";
    case "closed":
      return "border-sky-900 bg-sky-900 text-white";
    case "complete":
      return "border-green-700 bg-green-700 text-white";
  }
}

const DEAL_TYPE_KEY: Record<DealType, MessageKey> = {
  referral_residential: "deals.type.referral_residential",
  sale_residential: "deals.type.sale_residential",
  rental_commercial: "deals.type.rental_commercial",
  sale_commercial: "deals.type.sale_commercial",
};

const DEAL_SIDE_KEY: Record<DealSide, MessageKey> = {
  tenant: "deals.side.tenant",
  landlord: "deals.side.landlord",
  both: "deals.side.both",
};

const FEE_PAYER_KEY: Record<FeePayer, MessageKey> = {
  tenant: "deals.payer.tenant",
  landlord: "deals.payer.landlord",
  other: "deals.payer.other",
};

export function dealTypeLabel(type: string, locale: Locale = "en") {
  if (type in DEAL_TYPE_KEY) return translate(locale, DEAL_TYPE_KEY[type as DealType]);
  return type;
}

export function dealSideLabel(side: string, locale: Locale = "en") {
  if (side in DEAL_SIDE_KEY) return translate(locale, DEAL_SIDE_KEY[side as DealSide]);
  return side;
}

export function feePayerLabel(payer: string, locale: Locale = "en") {
  if (payer in FEE_PAYER_KEY) return translate(locale, FEE_PAYER_KEY[payer as FeePayer]);
  return payer;
}

export function formatDealPlace(deal: {
  address: string;
  unit?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}) {
  const street = formatAddress(deal.address, deal.unit?.trim() ? deal.unit.trim() : null);
  const stateZip = [deal.state?.trim(), deal.zip?.trim()].filter(Boolean).join(" ");
  const region = [deal.city?.trim(), stateZip].filter(Boolean).join(", ");
  return region ? `${street}, ${region}` : street;
}

const DEAL_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatSentAt(value: string, locale: Locale = "en") {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    timeZone: "America/New_York",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDealDate(value: string, locale: Locale = "en") {
  const match = DEAL_DAY.exec(value);
  if (!match) return value;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (locale === "ko") return `${year}년 ${month}월 ${day}일`;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[month - 1] ?? match[2]} ${day}, ${year}`;
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
