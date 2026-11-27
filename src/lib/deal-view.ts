import type { Deal, DealDocument, DealSide, DealType, FeePayer } from "@/lib/types";

export type DealDocumentLink = {
  id: string;
  name: string;
  href: string;
};

export type DealItem = {
  id: string;
  clientId: string;
  clientName: string;
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
  leadAgentId: string | null;
  leadAgentName: string | null;
  closeDate: string | null;
  grossCommissionCents: number | null;
  companySplitBps: number | null;
  referralFeeCents: number | null;
  documents: DealDocumentLink[];
  canEdit: boolean;
};

export type ClientDealView = {
  id: string;
  address: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
  dealType: DealType;
  monthlyRentCents: number | null;
  leaseStart: string | null;
  leaseEnd: string | null;
  documents: DealDocumentLink[];
};

function links(documents: DealDocument[], hrefFor: (id: string) => string): DealDocumentLink[] {
  return documents.map((document) => ({
    id: document.id,
    name: document.original_name,
    href: hrefFor(document.id),
  }));
}

export function presentDeal(
  deal: Deal,
  documents: DealDocument[],
  hrefFor: (id: string) => string,
  canEdit: boolean,
): DealItem {
  return {
    id: deal.id,
    clientId: deal.client_id,
    clientName: deal.client_name,
    propertyId: deal.property_id,
    address: deal.address,
    unit: deal.unit,
    city: deal.city,
    state: deal.state,
    zip: deal.zip,
    dealType: deal.deal_type,
    represented: deal.represented,
    monthlyRentCents: deal.monthly_rent_cents,
    leaseStart: deal.lease_start,
    leaseEnd: deal.lease_end,
    feePayer: deal.fee_payer,
    feePayerNote: deal.fee_payer_note,
    publiclyAdvertised: deal.publicly_advertised === 1,
    leadSource: deal.lead_source,
    leadAgentId: deal.lead_agent_id,
    leadAgentName: deal.lead_agent_name,
    closeDate: deal.close_date,
    grossCommissionCents: deal.gross_commission_cents,
    companySplitBps: deal.company_split_bps,
    referralFeeCents: deal.referral_fee_cents,
    documents: links(documents, hrefFor),
    canEdit,
  };
}

export function presentClientDeal(
  deal: Deal,
  documents: DealDocument[],
  hrefFor: (id: string) => string,
): ClientDealView {
  return {
    id: deal.id,
    address: deal.address,
    unit: deal.unit,
    city: deal.city,
    state: deal.state,
    zip: deal.zip,
    dealType: deal.deal_type,
    monthlyRentCents: deal.monthly_rent_cents,
    leaseStart: deal.lease_start,
    leaseEnd: deal.lease_end,
    documents: links(documents, hrefFor),
  };
}
