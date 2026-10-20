-- Adds commercial listings and amenity checkboxes.
-- Rebuilds properties so the listing_type check can include 'commercial'.
-- Copies washer_in_unit into the Washer & Dryer amenity.

CREATE TABLE property_media_mig (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'video')),
  storage_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  original_name TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO property_media_mig (
  id, property_id, kind, storage_key, content_type, original_name, sort_order, created_at
)
SELECT id, property_id, kind, storage_key, content_type, original_name, sort_order, created_at
FROM property_media;

DROP TABLE property_media;

CREATE TABLE property_assignments_mig (
  property_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (property_id, user_id)
);

INSERT INTO property_assignments_mig (property_id, user_id, created_at)
SELECT property_id, user_id, created_at
FROM property_assignments;

DROP TABLE property_assignments;

CREATE TABLE properties_mig (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  unit TEXT,
  price_cents INTEGER NOT NULL,
  listing_type TEXT NOT NULL CHECK (listing_type IN ('sale', 'rental', 'commercial')),
  neighborhood TEXT NOT NULL DEFAULT '',
  sqft INTEGER,
  bedrooms INTEGER,
  bathrooms REAL,
  amenities TEXT NOT NULL DEFAULT '{}',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('active', 'pending', 'rented', 'sold')),
  lat REAL,
  lng REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO properties_mig (
  id, address, unit, price_cents, listing_type, neighborhood, sqft, bedrooms, bathrooms,
  amenities, description, status, lat, lng, created_at, updated_at
)
SELECT
  id, address, unit, price_cents, listing_type, neighborhood, sqft, bedrooms, bathrooms,
  CASE WHEN washer_in_unit = 1 THEN '{"washerDryer":true}' ELSE '{}' END,
  description, status, lat, lng, created_at, updated_at
FROM properties;

DROP TABLE properties;

ALTER TABLE properties_mig RENAME TO properties;

CREATE TABLE property_media (
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

INSERT INTO property_media (
  id, property_id, kind, storage_key, content_type, original_name, sort_order, created_at
)
SELECT id, property_id, kind, storage_key, content_type, original_name, sort_order, created_at
FROM property_media_mig;

DROP TABLE property_media_mig;

CREATE TABLE property_assignments (
  property_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (property_id, user_id),
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO property_assignments (property_id, user_id, created_at)
SELECT property_id, user_id, created_at
FROM property_assignments_mig;

DROP TABLE property_assignments_mig;

CREATE INDEX IF NOT EXISTS idx_media_property ON property_media (property_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_assignments_user ON property_assignments (user_id);
