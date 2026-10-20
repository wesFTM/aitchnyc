import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
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

async function migrateProperties(db: Db, exec: (sql: string) => void) {
  const row = await db.get<{ sql: string | null }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'properties'",
  );
  const ddl = row?.sql ?? "";
  if (ddl.includes("amenities") && ddl.includes("'commercial'")) return;
  const fs = await import("node:fs");
  const path = await import("node:path");
  const sql = fs.readFileSync(path.join(process.cwd(), "migrations", "0002_commercial_amenities.sql"), "utf8");
  try {
    exec(`BEGIN;\n${sql}\nCOMMIT;`);
  } catch (error) {
    try {
      exec("ROLLBACK");
    } catch {
      // The failed statement already aborted the transaction.
    }
    throw error;
  }
}

async function prepareLocal(sqlite: LocalDatabase) {
  if (!localReady) {
    localReady = (async () => {
      sqlite.exec(schemaSql());
      await migrateProperties(localAdapter(sqlite), (sql) => sqlite.exec(sql));
    })().catch((error) => {
      localReady = null;
      throw error;
    });
  }
  await localReady;
}

export async function getDb(): Promise<Db> {
  const d1 = await cloudflareDb();
  if (d1) return d1Adapter(d1);

  const sqlite = await openLocal();
  await prepareLocal(sqlite);
  return localAdapter(sqlite);
}
