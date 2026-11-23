-- Every listing can be Active, Leased, Pending, or Inactive.
-- Rebuilds properties so the status check can include leased and inactive.
-- Rented and sold become leased. A commercial inactive flag becomes inactive.

DROP TABLE IF EXISTS listing_likes_mig;
DROP TABLE IF EXISTS property_media_mig;
DROP TABLE IF EXISTS property_assignments_mig;
DROP TABLE IF EXISTS properties_mig;

CREATE TABLE listing_likes_mig (
  user_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  tour_requested INTEGER NOT NULL DEFAULT 0 CHECK (tour_requested IN (0, 1)),
  tour_scheduled_at TEXT,
  PRIMARY KEY (user_id, property_id)
);

INSERT INTO listing_likes_mig (user_id, property_id, created_at, tour_requested, tour_scheduled_at)
SELECT user_id, property_id, created_at, tour_requested, tour_scheduled_at
FROM listing_likes;

DROP TABLE listing_likes;

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
  sqft_optional INTEGER,
  bedrooms INTEGER,
  bathrooms REAL,
  amenities TEXT NOT NULL DEFAULT '{}',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('active', 'leased', 'pending', 'inactive')),
  is_inactive INTEGER NOT NULL DEFAULT 0 CHECK (is_inactive IN (0, 1)),
  key_money_cents INTEGER,
  possession TEXT NOT NULL DEFAULT '',
  terms TEXT NOT NULL DEFAULT '',
  frontage TEXT NOT NULL DEFAULT '',
  ceiling_height TEXT NOT NULL DEFAULT '',
  neighboring_tenants TEXT NOT NULL DEFAULT '',
  lat REAL,
  lng REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO properties_mig (
  id, address, unit, price_cents, listing_type, neighborhood, sqft, sqft_optional,
  bedrooms, bathrooms, amenities, description, status, is_inactive, key_money_cents,
  possession, terms, frontage, ceiling_height, neighboring_tenants, lat, lng, created_at, updated_at
)
SELECT
  id, address, unit, price_cents, listing_type, neighborhood, sqft, sqft_optional,
  bedrooms, bathrooms, amenities, description,
  CASE
    WHEN IFNULL(is_inactive, 0) = 1 THEN 'inactive'
    WHEN status IN ('rented', 'sold', 'leased') THEN 'leased'
    WHEN status = 'pending' THEN 'pending'
    WHEN status = 'inactive' THEN 'inactive'
    ELSE 'active'
  END,
  CASE
    WHEN IFNULL(is_inactive, 0) = 1 OR status = 'inactive' THEN 1
    ELSE 0
  END,
  key_money_cents, possession, terms, frontage, ceiling_height, neighboring_tenants,
  lat, lng, created_at, updated_at
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

CREATE TABLE listing_likes (
  user_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  tour_requested INTEGER NOT NULL DEFAULT 0 CHECK (tour_requested IN (0, 1)),
  tour_scheduled_at TEXT,
  PRIMARY KEY (user_id, property_id),
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO listing_likes (user_id, property_id, created_at, tour_requested, tour_scheduled_at)
SELECT user_id, property_id, created_at, tour_requested, tour_scheduled_at
FROM listing_likes_mig;

DROP TABLE listing_likes_mig;

CREATE INDEX IF NOT EXISTS idx_media_property ON property_media (property_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_assignments_user ON property_assignments (user_id);
CREATE INDEX IF NOT EXISTS idx_listing_likes_user ON listing_likes (user_id);
