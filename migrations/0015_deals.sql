-- A deal ties a client to a listing, or to an address entered by hand.

CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  property_id TEXT,
  address TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  zip TEXT NOT NULL DEFAULT '',
  deal_type TEXT NOT NULL CHECK (deal_type IN ('referral_residential', 'sale_residential', 'rental_commercial', 'sale_commercial')),
  represented TEXT NOT NULL CHECK (represented IN ('tenant', 'landlord', 'both')),
  monthly_rent_cents INTEGER,
  lease_start TEXT,
  lease_end TEXT,
  fee_payer TEXT NOT NULL CHECK (fee_payer IN ('tenant', 'landlord', 'other')),
  fee_payer_note TEXT NOT NULL DEFAULT '',
  publicly_advertised INTEGER NOT NULL CHECK (publicly_advertised IN (0, 1)),
  lead_source TEXT NOT NULL DEFAULT '',
  lead_agent_id TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL,
  FOREIGN KEY (lead_agent_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_deals_client ON deals (client_id);
CREATE INDEX IF NOT EXISTS idx_deals_property ON deals (property_id);
CREATE INDEX IF NOT EXISTS idx_deals_lead_agent ON deals (lead_agent_id);

CREATE TABLE IF NOT EXISTS deal_documents (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  original_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_deal_documents_deal ON deal_documents (deal_id);
