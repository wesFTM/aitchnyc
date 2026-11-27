import type { Amenities } from "@/lib/amenities";

export type Role = "super_admin" | "admin" | "client";
export type ListingType = "sale" | "rental" | "commercial";
export type ListingStatus = "active" | "leased" | "pending" | "inactive";
export type MediaKind = "image" | "video";

export type User = {
  id: string;
  email: string;
  phone: string;
  name: string;
  role: Role;
  share_token: string | null;
  company_website: string;
  company_zip: string;
  logo_key: string | null;
  logo_content_type: string | null;
  signed_in_at: string | null;
  created_by: string | null;
  created_by_name?: string | null;
  hidden: number;
  flagged: number;
  flag_note: string;
  created_at: string;
};

export type ClientInput = {
  name: string;
  email: string;
  phone: string;
  companyWebsite: string;
  companyZip: string;
};

export type DealType = "referral_residential" | "sale_residential" | "rental_commercial" | "sale_commercial";
export type DealSide = "tenant" | "landlord" | "both";
export type FeePayer = "tenant" | "landlord" | "other";

export type DealInput = {
  clientId: string;
  propertyId: string | null;
  address: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
  dealType: DealType;
  represented: DealSide;
  monthlyRentCents: number | null;
  leaseStart: string | null;
  leaseEnd: string | null;
  feePayer: FeePayer;
  feePayerNote: string;
  publiclyAdvertised: boolean;
  leadSource: string;
  leadAgentId: string;
};

export type Deal = {
  id: string;
  client_id: string;
  client_name: string;
  property_id: string | null;
  address: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
  deal_type: DealType;
  represented: DealSide;
  monthly_rent_cents: number | null;
  lease_start: string | null;
  lease_end: string | null;
  fee_payer: FeePayer;
  fee_payer_note: string;
  publicly_advertised: number;
  lead_source: string;
  lead_agent_id: string | null;
  lead_agent_name: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DealDocument = {
  id: string;
  deal_id: string;
  storage_key: string;
  content_type: string;
  original_name: string;
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
  sqft_optional: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  amenities: string;
  description: string;
  status: ListingStatus;
  is_inactive: number;
  key_money_cents: number | null;
  possession: string;
  terms: string;
  frontage: string;
  ceiling_height: string;
  neighboring_tenants: string;
  lat: number | null;
  lng: number | null;
  created_by: string | null;
  created_by_name?: string | null;
  hidden: number;
  created_at: string;
  updated_at: string;
};

export type ClientDocument = {
  id: string;
  client_id: string;
  property_id: string;
  storage_key: string;
  content_type: string;
  original_name: string;
  created_at: string;
  address: string;
  unit: string | null;
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
  sqft_optional: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  amenities: Amenities;
  description: string;
  status: ListingStatus;
  is_inactive: number;
  key_money_cents: number | null;
  possession: string;
  terms: string;
  frontage: string;
  ceiling_height: string;
  neighboring_tenants: string;
};
