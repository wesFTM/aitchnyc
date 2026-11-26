-- Per-client hide for the street number on a residential listing.
-- The map pin stays. Commercial listings are never hidden.

CREATE TABLE IF NOT EXISTS street_number_hides (
  user_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, property_id),
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_street_number_hides_property ON street_number_hides (property_id);
