import "server-only";

import { getDb } from "@/lib/db";
import type {
  Property,
  PropertyInput,
  PropertyListItem,
  PropertyMedia,
  User,
} from "@/lib/types";

const COVER_SQL = `(
  SELECT id FROM property_media m
  WHERE m.property_id = p.id AND m.kind = 'image'
  ORDER BY m.sort_order ASC, m.created_at ASC
  LIMIT 1
) AS cover_id`;

export async function findUserById(id: string) {
  const db = await getDb();
  return db.get<User>("SELECT * FROM users WHERE id = ?", id);
}

export async function findUserByEmail(email: string) {
  const db = await getDb();
  return db.get<User>("SELECT * FROM users WHERE email = ?", email.toLowerCase());
}

export async function upsertSuperAdmin(email: string, name: string) {
  const db = await getDb();
  const normalized = email.toLowerCase();
  const existing = await findUserByEmail(normalized);
  if (!existing) {
    const id = crypto.randomUUID();
    await db.run(
      "INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, 'super_admin')",
      id,
      normalized,
      name || "Admin",
    );
    return (await findUserById(id))!;
  }
  if (existing.role !== "super_admin") {
    await db.run("UPDATE users SET role = 'super_admin' WHERE id = ?", existing.id);
  }
  return (await findUserById(existing.id))!;
}

export async function listClients() {
  const db = await getDb();
  return db.all<User>(
    "SELECT * FROM users WHERE role = 'client' ORDER BY name COLLATE NOCASE ASC",
  );
}

export async function insertClient(name: string, email: string) {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.run(
    "INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, 'client')",
    id,
    email.toLowerCase(),
    name,
  );
  return (await findUserById(id))!;
}

export async function updateClient(id: string, name: string, email: string) {
  const db = await getDb();
  await db.run(
    "UPDATE users SET name = ?, email = ? WHERE id = ? AND role = 'client'",
    name,
    email.toLowerCase(),
    id,
  );
}

export async function deleteClient(id: string) {
  const db = await getDb();
  await db.run("DELETE FROM property_assignments WHERE user_id = ?", id);
  await db.run("DELETE FROM users WHERE id = ? AND role = 'client'", id);
}

export async function listProperties() {
  const db = await getDb();
  return db.all<PropertyListItem>(
    `SELECT p.*, ${COVER_SQL} FROM properties p ORDER BY p.updated_at DESC`,
  );
}

export async function listPropertiesForUser(userId: string) {
  const db = await getDb();
  return db.all<PropertyListItem>(
    `SELECT p.*, ${COVER_SQL}
     FROM properties p
     JOIN property_assignments a ON a.property_id = p.id
     WHERE a.user_id = ?
     ORDER BY p.updated_at DESC`,
    userId,
  );
}

export async function getProperty(id: string) {
  const db = await getDb();
  return db.get<Property>("SELECT * FROM properties WHERE id = ?", id);
}

export async function insertProperty(
  input: PropertyInput,
  coords: { lat: number; lng: number } | null,
) {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.run(
    `INSERT INTO properties (
      id, address, unit, price_cents, listing_type, neighborhood, sqft, bedrooms,
      bathrooms, washer_in_unit, description, status, lat, lng
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.address,
    input.unit,
    input.price_cents,
    input.listing_type,
    input.neighborhood,
    input.sqft,
    input.bedrooms,
    input.bathrooms,
    input.washer_in_unit ? 1 : 0,
    input.description,
    input.status,
    coords?.lat ?? null,
    coords?.lng ?? null,
  );
  return id;
}

export async function updateProperty(
  id: string,
  input: PropertyInput,
  coords: { lat: number; lng: number } | null,
) {
  const db = await getDb();
  await db.run(
    `UPDATE properties SET
      address = ?, unit = ?, price_cents = ?, listing_type = ?, neighborhood = ?,
      sqft = ?, bedrooms = ?, bathrooms = ?, washer_in_unit = ?, description = ?,
      status = ?, lat = ?, lng = ?, updated_at = datetime('now')
     WHERE id = ?`,
    input.address,
    input.unit,
    input.price_cents,
    input.listing_type,
    input.neighborhood,
    input.sqft,
    input.bedrooms,
    input.bathrooms,
    input.washer_in_unit ? 1 : 0,
    input.description,
    input.status,
    coords?.lat ?? null,
    coords?.lng ?? null,
    id,
  );
}

export async function deleteProperty(id: string) {
  const db = await getDb();
  const media = await listMedia(id);
  await db.run("DELETE FROM property_assignments WHERE property_id = ?", id);
  await db.run("DELETE FROM property_media WHERE property_id = ?", id);
  await db.run("DELETE FROM properties WHERE id = ?", id);
  return media;
}

export async function listMedia(propertyId: string) {
  const db = await getDb();
  return db.all<PropertyMedia>(
    "SELECT * FROM property_media WHERE property_id = ? ORDER BY kind ASC, sort_order ASC, created_at ASC",
    propertyId,
  );
}

export async function getMedia(id: string) {
  const db = await getDb();
  return db.get<PropertyMedia>("SELECT * FROM property_media WHERE id = ?", id);
}

export async function countImages(propertyId: string) {
  const db = await getDb();
  const row = await db.get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM property_media WHERE property_id = ? AND kind = 'image'",
    propertyId,
  );
  return Number(row?.count ?? 0);
}

export async function nextImageSort(propertyId: string) {
  const db = await getDb();
  const row = await db.get<{ max_sort: number | null }>(
    "SELECT MAX(sort_order) AS max_sort FROM property_media WHERE property_id = ? AND kind = 'image'",
    propertyId,
  );
  return Number(row?.max_sort ?? -1) + 1;
}

export async function existingVideo(propertyId: string) {
  const db = await getDb();
  return db.get<PropertyMedia>(
    "SELECT * FROM property_media WHERE property_id = ? AND kind = 'video' LIMIT 1",
    propertyId,
  );
}

export async function insertMedia(media: {
  id: string;
  propertyId: string;
  kind: "image" | "video";
  storageKey: string;
  contentType: string;
  originalName: string;
  sortOrder: number;
}) {
  const db = await getDb();
  await db.run(
    `INSERT INTO property_media (
      id, property_id, kind, storage_key, content_type, original_name, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    media.id,
    media.propertyId,
    media.kind,
    media.storageKey,
    media.contentType,
    media.originalName,
    media.sortOrder,
  );
  await db.run("UPDATE properties SET updated_at = datetime('now') WHERE id = ?", media.propertyId);
}

export async function deleteMediaRow(id: string) {
  const db = await getDb();
  await db.run("DELETE FROM property_media WHERE id = ?", id);
}

export async function makeCover(propertyId: string, mediaId: string) {
  const images = (await listMedia(propertyId)).filter((item) => item.kind === "image");
  const chosen = images.find((item) => item.id === mediaId);
  if (!chosen) return false;
  const ordered = [chosen, ...images.filter((item) => item.id !== chosen.id)];
  const db = await getDb();
  for (let index = 0; index < ordered.length; index += 1) {
    await db.run("UPDATE property_media SET sort_order = ? WHERE id = ?", index, ordered[index].id);
  }
  return true;
}

export async function listAssignments() {
  const db = await getDb();
  return db.all<{ user_id: string; property_id: string }>(
    "SELECT user_id, property_id FROM property_assignments",
  );
}

export async function userCanViewProperty(userId: string, propertyId: string) {
  const db = await getDb();
  const row = await db.get<{ ok: number }>(
    "SELECT 1 AS ok FROM property_assignments WHERE user_id = ? AND property_id = ?",
    userId,
    propertyId,
  );
  return Boolean(row);
}

export async function replaceAssignments(userId: string, propertyIds: string[]) {
  const db = await getDb();
  if (propertyIds.length > 0) {
    const placeholders = propertyIds.map(() => "?").join(", ");
    const found = await db.all<{ id: string }>(
      `SELECT id FROM properties WHERE id IN (${placeholders})`,
      ...propertyIds,
    );
    if (found.length !== propertyIds.length) {
      return false;
    }
  }
  await db.run("DELETE FROM property_assignments WHERE user_id = ?", userId);
  for (const propertyId of propertyIds) {
    await db.run(
      "INSERT INTO property_assignments (property_id, user_id) VALUES (?, ?)",
      propertyId,
      userId,
    );
  }
  return true;
}
