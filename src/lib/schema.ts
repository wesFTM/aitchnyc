import fs from "node:fs";
import path from "node:path";

let cached: string | null = null;

export function schemaSql(): string {
  if (cached) return cached;
  cached = fs.readFileSync(
    path.join(process.cwd(), "migrations", "0001_init.sql"),
    "utf8",
  );
  return cached;
}
