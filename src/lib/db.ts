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
let schemaReady = false;

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

async function ensureSchema(exec: (sql: string) => Promise<unknown> | unknown) {
  if (schemaReady) return;
  await exec(schemaSql());
  schemaReady = true;
}

export async function getDb(): Promise<Db> {
  const d1 = await cloudflareDb();
  if (d1) return d1Adapter(d1);

  const sqlite = await openLocal();
  await ensureSchema((sql) => sqlite.exec(sql));
  return localAdapter(sqlite);
}
