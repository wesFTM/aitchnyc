-- D1 / SQLite schema for Aitch NYC listings.
-- Applied automatically on local boot, and via `wrangler d1 migrations apply` on Cloudflare.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'client')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  unit TEXT,
  price_cents INTEGER NOT NULL,
  listing_type TEXT NOT NULL CHECK (listing_type IN ('sale', 'rental')),
  neighborhood TEXT NOT NULL DEFAULT '',
  sqft INTEGER,
  bedrooms INTEGER,
  bathrooms REAL,
  washer_in_unit INTEGER NOT NULL DEFAULT 0 CHECK (washer_in_unit IN (0, 1)),
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('active', 'pending', 'rented', 'sold')),
  lat REAL,
  lng REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS property_media (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'video')),
  storage_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  original_name TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS property_assignments (
  property_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (property_id, user_id),
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_media_property ON property_media (property_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_assignments_user ON property_assignments (user_id);
