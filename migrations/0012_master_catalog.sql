-- Who added a listing or client, plus hide/flag controls for the master list.
-- Admin text edits and client-page picks are stored separately so they do not rewrite master rows.

ALTER TABLE properties ADD COLUMN created_by TEXT;
ALTER TABLE properties ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;

ALTER TABLE users ADD COLUMN created_by TEXT;
ALTER TABLE users ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN flagged INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN flag_note TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS admin_listing_edits (
  admin_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (admin_id, property_id),
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_client_edits (
  admin_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (admin_id, client_id),
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_client_pick_sets (
  admin_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  PRIMARY KEY (admin_id, client_id),
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_client_picks (
  admin_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  PRIMARY KEY (admin_id, client_id, property_id),
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_client_picks_property ON admin_client_picks (property_id);
