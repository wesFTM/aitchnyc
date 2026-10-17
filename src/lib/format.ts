import type { ListingStatus, ListingType } from "@/lib/types";

export function formatMoney(cents: number) {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}

export function formatPrice(cents: number, listingType: ListingType) {
  const money = formatMoney(cents);
  return listingType === "rental" ? `${money}/mo` : money;
}

export function dollarsInputValue(cents: number) {
  if (cents % 100 === 0) return String(cents / 100);
  return (cents / 100).toFixed(2);
}

export function listingTypeLabel(listingType: ListingType) {
  return listingType === "rental" ? "Rental" : "Sale";
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
  }
}

export function formatAddress(address: string, unit: string | null) {
  if (!unit) return address;
  return `${address}, ${unit}`;
}

export function formatFacts(property: {
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  washer_in_unit: number;
}) {
  const parts: string[] = [];
  if (property.bedrooms != null) {
    parts.push(`${property.bedrooms} bd`);
  }
  if (property.bathrooms != null) {
    parts.push(`${property.bathrooms} ba`);
  }
  if (property.sqft != null) {
    parts.push(`${property.sqft.toLocaleString("en-US")} sf`);
  }
  if (property.washer_in_unit) parts.push("washer");
  return parts.join(" · ");
}
