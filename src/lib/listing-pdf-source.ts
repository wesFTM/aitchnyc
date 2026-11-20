import { amenityLabels, parseAmenities } from "@/lib/amenities";
import { displayStatus, formatAddress, formatMoney, formatPrice, listingTypeLabel, statusLabel } from "@/lib/format";
import type { Property } from "@/lib/types";

export type ListingPdfSource = {
  heading: string;
  eyebrow: string;
  price: string;
  priceNote: string;
  neighborhood: string;
  facts: { label: string; value: string }[];
  amenities: string[];
  description: string;
  extraLabel: string;
  extra: string;
  imageUrls: string[];
};

export function listingPdfSources(
  properties: Property[],
  images: { id: string; property_id: string }[],
  imageUrl: (id: string) => string,
) {
  const byProperty = new Map<string, string[]>();
  for (const image of images) {
    const current = byProperty.get(image.property_id) ?? [];
    current.push(image.id);
    byProperty.set(image.property_id, current);
  }
  return properties.map((property) => listingPdfSource(property, byProperty.get(property.id) ?? [], imageUrl));
}

export function pdfFilename(name: string) {
  const cleaned = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${cleaned || "listings"}-listings.pdf`;
}

export function listingPdfSource(
  property: Property,
  imageIds: string[],
  imageUrl: (id: string) => string,
): ListingPdfSource {
  const commercial = property.listing_type === "commercial";
  const facts = commercial
    ? [
        {
          label: "Key money",
          value: property.key_money_cents == null ? "—" : formatMoney(property.key_money_cents),
        },
        { label: "Sqft - Ground", value: property.sqft?.toLocaleString("en-US") || "—" },
        { label: "Sqft - Optional", value: property.sqft_optional?.toLocaleString("en-US") || "—" },
        { label: "Possession", value: property.possession || "—" },
        { label: "Terms", value: property.terms || "—" },
        { label: "Frontage", value: property.frontage || "—" },
        { label: "Ceiling height", value: property.ceiling_height || "—" },
      ]
    : [
        { label: "Bedrooms", value: property.bedrooms?.toString() || "—" },
        { label: "Bathrooms", value: property.bathrooms?.toString() || "—" },
        { label: "Square footage", value: property.sqft?.toLocaleString("en-US") || "—" },
      ];

  return {
    heading: formatAddress(property.address, property.unit),
    eyebrow: `${listingTypeLabel(property.listing_type)} · ${statusLabel(displayStatus(property))}`,
    price: formatPrice(property.price_cents, property.listing_type),
    priceNote: commercial ? "Asking rent" : "",
    neighborhood: property.neighborhood,
    facts,
    amenities: commercial ? [] : amenityLabels(parseAmenities(property.amenities)),
    description: property.description,
    extraLabel: commercial && property.neighboring_tenants ? "Neighboring tenants" : "",
    extra: commercial ? property.neighboring_tenants : "",
    imageUrls: imageIds.slice(0, 4).map((id) => imageUrl(id)),
  };
}
