import "server-only";

import { serializeAmenities } from "@/lib/amenities";
import { getDb } from "@/lib/db";
import { newShareToken } from "@/lib/share";
import type {
  ClientInput,
  Property,
  PropertyInput,
  PropertyListItem,
  PropertyMedia,
  User,
} from "@/lib/types";

const BLANK_EMAIL_DOMAIN = "@clients.invalid";

export function clientEmailForStorage(email: string, id: string) {
  const normalized = email.trim().toLowerCase();
  return normalized || `blank+${id}${BLANK_EMAIL_DOMAIN}`;
}

export function clientEmailForForm(email: string) {
  return email.endsWith(BLANK_EMAIL_DOMAIN) ? "" : email;
}

function presentClient(user: User): User {
  return { ...user, email: clientEmailForForm(user.email), phone: user.phone || "" };
}

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
  const normalized = email.trim().toLowerCase();
  if (!normalized || normalized.endsWith(BLANK_EMAIL_DOMAIN)) return undefined;
  const db = await getDb();
  return db.get<User>("SELECT * FROM users WHERE email = ?", normalized);
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
  const clients = await db.all<User>(
    "SELECT * FROM users WHERE role = 'client' ORDER BY name COLLATE NOCASE ASC",
  );
  return clients.map(presentClient);
}

export async function insertClient(input: ClientInput) {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.run(
    "INSERT INTO users (id, email, name, phone, role, share_token, company_website, company_zip) VALUES (?, ?, ?, ?, 'client', ?, ?, ?)",
    id,
    clientEmailForStorage(input.email, id),
    input.name,
    input.phone,
    newShareToken(),
    input.companyWebsite,
    input.companyZip,
  );
  return presentClient((await findUserById(id))!);
}

export async function findClientByShareToken(token: string) {
  const db = await getDb();
  return db.get<User>(
    "SELECT * FROM users WHERE role = 'client' AND share_token = ?",
    token,
  );
}

export async function updateClient(id: string, input: ClientInput) {
  const db = await getDb();
  await db.run(
    "UPDATE users SET name = ?, email = ?, phone = ?, company_website = ?, company_zip = ? WHERE id = ? AND role = 'client'",
    input.name,
    clientEmailForStorage(input.email, id),
    input.phone,
    input.companyWebsite,
    input.companyZip,
    id,
  );
}

export async function setClientLogo(id: string, logoKey: string | null, contentType: string | null) {
  const db = await getDb();
  await db.run(
    "UPDATE users SET logo_key = ?, logo_content_type = ? WHERE id = ? AND role = 'client'",
    logoKey,
    contentType,
    id,
  );
}

export async function deleteClient(id: string) {
  const db = await getDb();
  await db.run("DELETE FROM listing_likes WHERE user_id = ?", id);
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
      id, address, unit, price_cents, listing_type, neighborhood, sqft, sqft_optional,
      bedrooms, bathrooms, amenities, description, status, is_inactive, key_money_cents,
      possession, terms, frontage, ceiling_height, neighboring_tenants, lat, lng
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.address,
    input.unit,
    input.price_cents,
    input.listing_type,
    input.neighborhood,
    input.sqft,
    input.sqft_optional,
    input.bedrooms,
    input.bathrooms,
    serializeAmenities(input.amenities),
    input.description,
    input.status,
    input.is_inactive,
    input.key_money_cents,
    input.possession,
    input.terms,
    input.frontage,
    input.ceiling_height,
    input.neighboring_tenants,
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
      sqft = ?, sqft_optional = ?, bedrooms = ?, bathrooms = ?, amenities = ?,
      description = ?, status = ?, is_inactive = ?, key_money_cents = ?, possession = ?,
      terms = ?, frontage = ?, ceiling_height = ?, neighboring_tenants = ?, lat = ?,
      lng = ?, updated_at = datetime('now')
     WHERE id = ?`,
    input.address,
    input.unit,
    input.price_cents,
    input.listing_type,
    input.neighborhood,
    input.sqft,
    input.sqft_optional,
    input.bedrooms,
    input.bathrooms,
    serializeAmenities(input.amenities),
    input.description,
    input.status,
    input.is_inactive,
    input.key_money_cents,
    input.possession,
    input.terms,
    input.frontage,
    input.ceiling_height,
    input.neighboring_tenants,
    coords?.lat ?? null,
    coords?.lng ?? null,
    id,
  );
}

export async function deleteProperty(id: string) {
  const db = await getDb();
  const media = await listMedia(id);
  await db.run("DELETE FROM listing_likes WHERE property_id = ?", id);
  await db.run("DELETE FROM property_assignments WHERE property_id = ?", id);
  await db.run("DELETE FROM property_media WHERE property_id = ?", id);
  await db.run("DELETE FROM properties WHERE id = ?", id);
  return media;
}

export async function listPropertiesByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const db = await getDb();
  const placeholders = ids.map(() => "?").join(", ");
  const rows = await db.all<Property>(
    `SELECT * FROM properties WHERE id IN (${placeholders})`,
    ...ids,
  );
  const order = new Map(ids.map((id, index) => [id, index]));
  return rows.sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
}

export async function listImageIdsForProperties(propertyIds: string[]) {
  if (propertyIds.length === 0) return [];
  const db = await getDb();
  const placeholders = propertyIds.map(() => "?").join(", ");
  return db.all<{ id: string; property_id: string }>(
    `SELECT id, property_id FROM property_media
     WHERE kind = 'image' AND property_id IN (${placeholders})
     ORDER BY sort_order ASC, created_at ASC`,
    ...propertyIds,
  );
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

export async function listLikedPropertyIds(userId: string) {
  const db = await getDb();
  const rows = await db.all<{ property_id: string }>(
    "SELECT property_id FROM listing_likes WHERE user_id = ? ORDER BY created_at DESC",
    userId,
  );
  return rows.map((row) => row.property_id);
}

export async function isListingLiked(userId: string, propertyId: string) {
  const db = await getDb();
  const row = await db.get<{ ok: number }>(
    "SELECT 1 AS ok FROM listing_likes WHERE user_id = ? AND property_id = ?",
    userId,
    propertyId,
  );
  return Boolean(row);
}

export async function listClientInterest(userId: string) {
  const db = await getDb();
  const rows = await db.all<{ property_id: string; tour_requested: number; tour_scheduled_at: string | null }>(
    "SELECT property_id, tour_requested, tour_scheduled_at FROM listing_likes WHERE user_id = ? ORDER BY tour_requested DESC, created_at DESC",
    userId,
  );
  const tourSchedules: Record<string, string> = {};
  for (const row of rows) {
    if (row.tour_requested && row.tour_scheduled_at) tourSchedules[row.property_id] = row.tour_scheduled_at;
  }
  return {
    likedIds: rows.map((row) => row.property_id),
    tourIds: rows.filter((row) => row.tour_requested).map((row) => row.property_id),
    tourSchedules,
  };
}

export async function getListingInterest(userId: string, propertyId: string) {
  const db = await getDb();
  const row = await db.get<{ tour_requested: number; tour_scheduled_at: string | null }>(
    "SELECT tour_requested, tour_scheduled_at FROM listing_likes WHERE user_id = ? AND property_id = ?",
    userId,
    propertyId,
  );
  return {
    liked: Boolean(row),
    tourRequested: Boolean(row?.tour_requested),
    tourScheduledAt: row?.tour_requested && row.tour_scheduled_at ? row.tour_scheduled_at : null,
  };
}

export async function listLikes() {
  const db = await getDb();
  return db.all<{ user_id: string; property_id: string; tour_requested: number; tour_scheduled_at: string | null }>(
    "SELECT user_id, property_id, tour_requested, tour_scheduled_at FROM listing_likes ORDER BY tour_requested DESC, created_at DESC, property_id ASC",
  );
}

export async function listInterestedClients(propertyId: string) {
  const db = await getDb();
  return db.all<{ id: string; name: string; tour_requested: number; tour_scheduled_at: string | null }>(
    `SELECT u.id, u.name, l.tour_requested, l.tour_scheduled_at
     FROM listing_likes l
     JOIN users u ON u.id = l.user_id
     WHERE l.property_id = ? AND u.role = 'client'
     ORDER BY l.tour_requested DESC, l.created_at DESC, u.name COLLATE NOCASE ASC`,
    propertyId,
  );
}

export async function setTourRequest(userId: string, propertyId: string, requested: boolean) {
  if (!(await userCanViewProperty(userId, propertyId))) return false;
  if (!(await isListingLiked(userId, propertyId))) return false;
  const db = await getDb();
  await db.run(
    "UPDATE listing_likes SET tour_requested = ?, tour_scheduled_at = CASE WHEN ? = 0 THEN NULL ELSE tour_scheduled_at END WHERE user_id = ? AND property_id = ?",
    requested ? 1 : 0,
    requested ? 1 : 0,
    userId,
    propertyId,
  );
  return true;
}

export async function scheduleTour(userId: string, propertyId: string, scheduledAt: string | null) {
  const db = await getDb();
  const row = await db.get<{ tour_requested: number }>(
    "SELECT tour_requested FROM listing_likes WHERE user_id = ? AND property_id = ?",
    userId,
    propertyId,
  );
  if (!row?.tour_requested) return false;
  await db.run(
    "UPDATE listing_likes SET tour_scheduled_at = ? WHERE user_id = ? AND property_id = ?",
    scheduledAt,
    userId,
    propertyId,
  );
  return true;
}

export async function setListingLike(userId: string, propertyId: string, liked: boolean) {
  const allowed = await userCanViewProperty(userId, propertyId);
  if (!allowed) return false;
  const db = await getDb();
  if (liked) {
    await db.run(
      "INSERT OR IGNORE INTO listing_likes (user_id, property_id) VALUES (?, ?)",
      userId,
      propertyId,
    );
  } else {
    await db.run("DELETE FROM listing_likes WHERE user_id = ? AND property_id = ?", userId, propertyId);
  }
  return true;
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
