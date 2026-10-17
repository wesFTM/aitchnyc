export type Role = "super_admin" | "client";
export type ListingType = "sale" | "rental";
export type ListingStatus = "active" | "pending" | "rented" | "sold";
export type MediaKind = "image" | "video";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  created_at: string;
};

export type Property = {
  id: string;
  address: string;
  unit: string | null;
  price_cents: number;
  listing_type: ListingType;
  neighborhood: string;
  sqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  washer_in_unit: number;
  description: string;
  status: ListingStatus;
  lat: number | null;
  lng: number | null;
  created_at: string;
  updated_at: string;
};

export type PropertyMedia = {
  id: string;
  property_id: string;
  kind: MediaKind;
  storage_key: string;
  content_type: string;
  original_name: string | null;
  sort_order: number;
  created_at: string;
};

export type PropertyListItem = Property & {
  cover_id: string | null;
};

export type PropertyInput = {
  address: string;
  unit: string | null;
  price_cents: number;
  listing_type: ListingType;
  neighborhood: string;
  sqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  washer_in_unit: boolean;
  description: string;
  status: ListingStatus;
};
