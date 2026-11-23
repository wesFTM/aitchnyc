import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { listingStatusMigrationSql } from "@/lib/listing-status-migration";
import { schemaSql } from "@/lib/schema";
import { cloudflareBindingsEnabled } from "@/lib/runtime";

export type SqlValue = string | number | null;

export interface Db {
  all<T>(sql: string, ...params: SqlValue[]): Promise<T[]>;
  get<T>(sql: string, ...params: SqlValue[]): Promise<T | undefined>;
  run(sql: string, ...params: SqlValue[]): Promise<void>;
}

type LocalDatabase = {
  exec(sql: string): void;
  prepare(sql: string): {
    all(...params: SqlValue[]): object[];
    get(...params: SqlValue[]): object | undefined;
    run(...params: SqlValue[]): unknown;
  };
};

let localDb: LocalDatabase | null = null;
let localReady: Promise<void> | null = null;

function bindParams(params: SqlValue[]): SqlValue[] {
  return params.map((value) => (value === undefined ? null : value));
}

async function openLocal(): Promise<LocalDatabase> {
  if (localDb) return localDb;
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { DatabaseSync } = await import("node:sqlite");
  const dir = path.join(process.cwd(), ".data");
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "aitchnyc.sqlite")) as LocalDatabase;
  db.exec("PRAGMA foreign_keys = ON");
  localDb = db;
  return db;
}

function plainRow<T>(row: object): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    result[key] = typeof value === "bigint" ? Number(value) : value;
  }
  return result as T;
}

function localAdapter(db: LocalDatabase): Db {
  return {
    async all<T>(sql: string, ...params: SqlValue[]) {
      return db.prepare(sql).all(...bindParams(params)).map((row) => plainRow<T>(row));
    },
    async get<T>(sql: string, ...params: SqlValue[]) {
      const row = db.prepare(sql).get(...bindParams(params));
      return row ? plainRow<T>(row) : undefined;
    },
    async run(sql: string, ...params: SqlValue[]) {
      db.prepare(sql).run(...bindParams(params));
    },
  };
}

function d1Adapter(db: D1Database): Db {
  return {
    async all<T>(sql: string, ...params: SqlValue[]) {
      const result = await db.prepare(sql).bind(...bindParams(params)).all<T>();
      return result.results ?? [];
    },
    async get<T>(sql: string, ...params: SqlValue[]) {
      const row = await db.prepare(sql).bind(...bindParams(params)).first<T>();
      return row ?? undefined;
    },
    async run(sql: string, ...params: SqlValue[]) {
      await db.prepare(sql).bind(...bindParams(params)).run();
    },
  };
}

async function cloudflareDb(): Promise<D1Database | null> {
  if (!cloudflareBindingsEnabled()) return null;
  const { env } = await getCloudflareContext({ async: true });
  if (!env.DB) {
    throw new Error("The DB D1 binding is missing. Check wrangler.jsonc.");
  }
  return env.DB;
}

const MIGRATION_NAMES = [
  "0001_init.sql",
  "0002_commercial_amenities.sql",
  "0003_commercial_fields.sql",
  "0004_client_share.sql",
  "0005_client_company.sql",
  "0006_client_phone.sql",
  "0007_listing_likes.sql",
  "0008_tour_requests.sql",
  "0009_tour_schedule.sql",
  "0010_listing_status.sql",
];

const CLIENT_COLUMNS = [
  "company_website TEXT NOT NULL DEFAULT ''",
  "company_zip TEXT NOT NULL DEFAULT ''",
  "logo_key TEXT",
  "logo_content_type TEXT",
  "phone TEXT NOT NULL DEFAULT ''",
];

async function execMigration(
  exec: (sql: string) => void | Promise<void>,
  sql: string,
  transaction: boolean,
) {
  const statement = transaction ? `BEGIN;\n${sql}\nCOMMIT;` : sql;
  try {
    await exec(statement);
  } catch (error) {
    if (transaction) {
      try {
        await exec("ROLLBACK");
      } catch {
        // The failed statement already aborted the transaction.
      }
    }
    throw error;
  }
}

async function applyMigration(
  exec: (sql: string) => void | Promise<void>,
  filename: string,
  transaction: boolean,
) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const sql = fs.readFileSync(path.join(process.cwd(), "migrations", filename), "utf8");
  await execMigration(exec, sql, transaction);
}

const COMMERCIAL_COLUMNS = [
  "sqft_optional INTEGER",
  "key_money_cents INTEGER",
  "possession TEXT NOT NULL DEFAULT ''",
  "terms TEXT NOT NULL DEFAULT ''",
  "frontage TEXT NOT NULL DEFAULT ''",
  "ceiling_height TEXT NOT NULL DEFAULT ''",
  "neighboring_tenants TEXT NOT NULL DEFAULT ''",
  "is_inactive INTEGER NOT NULL DEFAULT 0 CHECK (is_inactive IN (0, 1))",
];

async function ensureCommercialColumns(db: Db) {
  for (const definition of COMMERCIAL_COLUMNS) {
    const name = definition.split(" ")[0];
    const columns = await db.all<{ name: string }>("PRAGMA table_info(properties)");
    if (columns.some((column) => column.name === name)) continue;
    await db.run(`ALTER TABLE properties ADD COLUMN ${definition}`);
  }
}

async function migrateProperties(
  db: Db,
  exec: (sql: string) => void | Promise<void>,
  transaction: boolean,
) {
  const row = await db.get<{ sql: string | null }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'properties'",
  );
  const ddl = row?.sql ?? "";
  if (!ddl.includes("amenities") || !ddl.includes("'commercial'")) {
    await applyMigration(exec, "0002_commercial_amenities.sql", transaction);
  }
  await ensureCommercialColumns(db);
  await ensureShareTokens(db);
  await ensureClientProfile(db);
  await ensureListingLikes(db);
  await ensureListingStatus(db, exec, transaction);
  await recordMigrations(db);
}

async function ensureListingStatus(
  db: Db,
  exec: (sql: string) => void | Promise<void>,
  transaction: boolean,
) {
  const row = await db.get<{ sql: string | null }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'properties'",
  );
  if ((row?.sql ?? "").includes("'leased'")) return;
  await execMigration(exec, listingStatusMigrationSql, transaction);
}

async function ensureListingLikes(db: Db) {
  await db.run(
    `CREATE TABLE IF NOT EXISTS listing_likes (
      user_id TEXT NOT NULL,
      property_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      tour_requested INTEGER NOT NULL DEFAULT 0 CHECK (tour_requested IN (0, 1)),
      tour_scheduled_at TEXT,
      PRIMARY KEY (user_id, property_id),
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
  );
  await db.run("CREATE INDEX IF NOT EXISTS idx_listing_likes_user ON listing_likes (user_id)");
  const columns = await db.all<{ name: string }>("PRAGMA table_info(listing_likes)");
  if (!columns.some((column) => column.name === "tour_requested")) {
    await db.run("ALTER TABLE listing_likes ADD COLUMN tour_requested INTEGER NOT NULL DEFAULT 0");
  }
  if (!columns.some((column) => column.name === "tour_scheduled_at")) {
    await db.run("ALTER TABLE listing_likes ADD COLUMN tour_scheduled_at TEXT");
  }
}

async function ensureClientProfile(db: Db) {
  const columns = await db.all<{ name: string }>("PRAGMA table_info(users)");
  const names = new Set(columns.map((column) => column.name));
  for (const definition of CLIENT_COLUMNS) {
    const name = definition.split(" ")[0];
    if (names.has(name)) continue;
    await db.run(`ALTER TABLE users ADD COLUMN ${definition}`);
  }
}

async function ensureShareTokens(db: Db) {
  const columns = await db.all<{ name: string }>("PRAGMA table_info(users)");
  if (!columns.some((column) => column.name === "share_token")) {
    await db.run("ALTER TABLE users ADD COLUMN share_token TEXT");
  }
  await db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_share_token ON users (share_token)");
  const missing = await db.all<{ id: string }>(
    "SELECT id FROM users WHERE role = 'client' AND (share_token IS NULL OR share_token = '')",
  );
  for (const row of missing) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    await db.run("UPDATE users SET share_token = ? WHERE id = ?", token, row.id);
  }
}

async function recordMigrations(db: Db) {
  const columns = await db.all<{ name: string }>("PRAGMA table_info(properties)");
  if (!columns.some((column) => column.name === "key_money_cents")) return;
  await db.run(
    `CREATE TABLE IF NOT EXISTS d1_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  );
  for (const name of MIGRATION_NAMES) {
    await db.run("INSERT OR IGNORE INTO d1_migrations (name) VALUES (?)", name);
  }
}

let remoteReady: Promise<void> | null = null;
let clientProfileReady = false;
let listingLikesReady = false;

async function ensureProfileOnce(db: Db) {
  if (clientProfileReady) return;
  await ensureClientProfile(db);
  clientProfileReady = true;
}

async function ensureLikesOnce(db: Db) {
  if (listingLikesReady) return;
  await ensureListingLikes(db);
  listingLikesReady = true;
}

async function prepareRemote(d1: D1Database) {
  if (!remoteReady) {
    remoteReady = (async () => {
      await migrateProperties(
        d1Adapter(d1),
        async (sql) => {
          await d1.exec(sql);
        },
        false,
      );
    })().catch((error) => {
      remoteReady = null;
      throw error;
    });
  }
  await remoteReady;
  await ensureProfileOnce(d1Adapter(d1));
  await ensureLikesOnce(d1Adapter(d1));
}

async function prepareLocal(sqlite: LocalDatabase) {
  if (!localReady) {
    localReady = (async () => {
      sqlite.exec(schemaSql());
      await migrateProperties(localAdapter(sqlite), (sql) => sqlite.exec(sql), true);
    })().catch((error) => {
      localReady = null;
      throw error;
    });
  }
  await localReady;
  await ensureProfileOnce(localAdapter(sqlite));
  await ensureLikesOnce(localAdapter(sqlite));
}

export async function getDb(): Promise<Db> {
  const d1 = await cloudflareDb();
  if (d1) {
    await prepareRemote(d1);
    return d1Adapter(d1);
  }

  const sqlite = await openLocal();
  await prepareLocal(sqlite);
  return localAdapter(sqlite);
}
