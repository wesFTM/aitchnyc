// Inlined so the Worker can migrate without reading migrations/ from disk.
// Keep this identical to migrations/0011_admin_role.sql.
export const adminRoleMigrationSql = `
DROP TABLE IF EXISTS admin_listing_grants;
DROP TABLE IF EXISTS admin_client_grants;
DROP TABLE IF EXISTS listing_likes_admin_mig;
DROP TABLE IF EXISTS property_assignments_admin_mig;
DROP TABLE IF EXISTS users_admin_mig;

CREATE TABLE property_assignments_admin_mig (
  property_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (property_id, user_id)
);

INSERT INTO property_assignments_admin_mig (property_id, user_id, created_at)
SELECT property_id, user_id, created_at
FROM property_assignments;

DROP TABLE property_assignments;

CREATE TABLE listing_likes_admin_mig (
  user_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  tour_requested INTEGER NOT NULL DEFAULT 0 CHECK (tour_requested IN (0, 1)),
  tour_scheduled_at TEXT,
  PRIMARY KEY (user_id, property_id)
);

INSERT INTO listing_likes_admin_mig (user_id, property_id, created_at, tour_requested, tour_scheduled_at)
SELECT user_id, property_id, created_at, tour_requested, tour_scheduled_at
FROM listing_likes;

DROP TABLE listing_likes;

CREATE TABLE users_admin_mig (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'client')),
  phone TEXT NOT NULL DEFAULT '',
  share_token TEXT,
  company_website TEXT NOT NULL DEFAULT '',
  company_zip TEXT NOT NULL DEFAULT '',
  logo_key TEXT,
  logo_content_type TEXT,
  signed_in_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO users_admin_mig (
  id, email, name, role, phone, share_token, company_website, company_zip,
  logo_key, logo_content_type, created_at
)
SELECT
  id, email, name, role,
  IFNULL(phone, ''),
  share_token,
  IFNULL(company_website, ''),
  IFNULL(company_zip, ''),
  logo_key,
  logo_content_type,
  created_at
FROM users;

DROP TABLE users;

ALTER TABLE users_admin_mig RENAME TO users;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_share_token ON users (share_token);

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
FROM property_assignments_admin_mig;

DROP TABLE property_assignments_admin_mig;

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
FROM listing_likes_admin_mig;

DROP TABLE listing_likes_admin_mig;

CREATE INDEX IF NOT EXISTS idx_assignments_user ON property_assignments (user_id);
CREATE INDEX IF NOT EXISTS idx_listing_likes_user ON listing_likes (user_id);

CREATE TABLE admin_listing_grants (
  user_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, property_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

CREATE TABLE admin_client_grants (
  user_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, client_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_listing_property ON admin_listing_grants (property_id);
CREATE INDEX IF NOT EXISTS idx_admin_client_client ON admin_client_grants (client_id);
`;
