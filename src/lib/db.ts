import "server-only";

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { schemaSql } from "@/lib/schema";

export type SqlValue = string | number | null;

export interface Db {
  all<T>(sql: string, ...params: SqlValue[]): Promise<T[]>;
  get<T>(sql: string, ...params: SqlValue[]): Promise<T | undefined>;
  run(sql: string, ...params: SqlValue[]): Promise<void>;
}

let localDb: DatabaseSync | null = null;
let schemaReady = false;

function bindParams(params: SqlValue[]): SqlValue[] {
  return params.map((value) => (value === undefined ? null : value));
}

function openLocal(): DatabaseSync {
  if (localDb) return localDb;
  const dir = path.join(process.cwd(), ".data");
  fs.mkdirSync(dir, { recursive: true });
  localDb = new DatabaseSync(path.join(dir, "aitchnyc.sqlite"));
  localDb.exec("PRAGMA foreign_keys = ON");
  return localDb;
}

function plainRow<T>(row: object): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    result[key] = typeof value === "bigint" ? Number(value) : value;
  }
  return result as T;
}

function localAdapter(db: DatabaseSync): Db {
  return {
    async all<T>(sql: string, ...params: SqlValue[]) {
      return (db.prepare(sql).all(...bindParams(params)) as object[]).map((row) => plainRow<T>(row));
    },
    async get<T>(sql: string, ...params: SqlValue[]) {
      const row = db.prepare(sql).get(...bindParams(params));
      return row ? plainRow<T>(row as object) : undefined;
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
  if (process.env.USE_CLOUDFLARE_BINDINGS !== "1") return null;
  try {
    const loaded = (await new Function("specifier", "return import(specifier)")(
      "@opennextjs/cloudflare",
    )) as {
      getCloudflareContext: (options?: { async?: boolean }) => Promise<{ env: { DB?: D1Database } }>;
    };
    const { env } = await loaded.getCloudflareContext({ async: true });
    return env.DB ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    throw new Error(
      `Cloudflare bindings are enabled but D1 is unavailable (${message}). Install @opennextjs/cloudflare and check wrangler.jsonc, or unset USE_CLOUDFLARE_BINDINGS.`,
    );
  }
}

async function ensureSchema(exec: (sql: string) => Promise<unknown> | unknown) {
  if (schemaReady) return;
  await exec(schemaSql());
  schemaReady = true;
}

export async function getDb(): Promise<Db> {
  const d1 = await cloudflareDb();
  if (d1) {
    await ensureSchema((sql) => d1.exec(sql));
    return d1Adapter(d1);
  }

  const sqlite = openLocal();
  await ensureSchema((sql) => sqlite.exec(sql));
  return localAdapter(sqlite);
}
