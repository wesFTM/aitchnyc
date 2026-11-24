import "server-only";

import { serializeAmenities } from "@/lib/amenities";
import { getDb } from "@/lib/db";
import { newShareToken } from "@/lib/share";
import type {
  ClientInput,
  ListingStatus,
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
    await db.run("DELETE FROM admin_listing_grants WHERE user_id = ?", existing.id);
    await db.run("DELETE FROM admin_client_grants WHERE user_id = ?", existing.id);
  }
  return (await findUserById(existing.id))!;
}

export async function listAdmins() {
  const db = await getDb();
  return db.all<User>("SELECT * FROM users WHERE role = 'admin' ORDER BY name COLLATE NOCASE ASC, email COLLATE NOCASE ASC");
}

export async function insertAdmin(email: string, name: string) {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.run("INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, 'admin')", id, email, name);
  return (await findUserById(id))!;
}

export async function updateAdmin(id: string, email: string, name: string) {
  const db = await getDb();
  await db.run("UPDATE users SET email = ?, name = ? WHERE id = ? AND role = 'admin'", email, name, id);
}

export async function deleteAdmin(id: string) {
  const db = await getDb();
  await db.run("DELETE FROM admin_listing_grants WHERE user_id = ?", id);
  await db.run("DELETE FROM admin_client_grants WHERE user_id = ?", id);
  await db.run("DELETE FROM admin_listing_edits WHERE admin_id = ?", id);
  await db.run("DELETE FROM admin_client_edits WHERE admin_id = ?", id);
  await db.run("DELETE FROM admin_client_picks WHERE admin_id = ?", id);
  await db.run("DELETE FROM admin_client_pick_sets WHERE admin_id = ?", id);
  await db.run("DELETE FROM users WHERE id = ? AND role = 'admin'", id);
}

export async function markAdminSignIn(user: User, profileName?: string) {
  const incoming = profileName?.trim();
  const fallback = user.email.split("@")[0] || "Admin";
  const name = incoming && (user.name === fallback || user.name === user.email) ? incoming : user.name;
  const db = await getDb();
  await db.run(
    "UPDATE users SET name = ?, signed_in_at = datetime('now') WHERE id = ? AND role = 'admin'",
    name,
    user.id,
  );
  return (await findUserById(user.id)) ?? user;
}

export async function listAdminListingGrants() {
  const db = await getDb();
  return db.all<{ user_id: string; property_id: string }>("SELECT user_id, property_id FROM admin_listing_grants");
}

export async function listAdminClientGrants() {
  const db = await getDb();
  return db.all<{ user_id: string; client_id: string }>("SELECT user_id, client_id FROM admin_client_grants");
}

export async function replaceAdminGrants(userId: string, propertyIds: string[], clientIds: string[]) {
  const db = await getDb();
  if (propertyIds.length > 0) {
    const placeholders = propertyIds.map(() => "?").join(", ");
    const found = await db.all<{ id: string }>(
      `SELECT id FROM properties WHERE id IN (${placeholders})`,
      ...propertyIds,
    );
    if (found.length !== propertyIds.length) return false;
  }
  if (clientIds.length > 0) {
    const placeholders = clientIds.map(() => "?").join(", ");
    const found = await db.all<{ id: string }>(
      `SELECT id FROM users WHERE role = 'client' AND id IN (${placeholders})`,
      ...clientIds,
    );
    if (found.length !== clientIds.length) return false;
  }
  await db.run("DELETE FROM admin_listing_grants WHERE user_id = ?", userId);
  for (const propertyId of propertyIds) {
    await db.run("INSERT INTO admin_listing_grants (user_id, property_id) VALUES (?, ?)", userId, propertyId);
  }
  await db.run("DELETE FROM admin_client_grants WHERE user_id = ?", userId);
  for (const clientId of clientIds) {
    await db.run("INSERT INTO admin_client_grants (user_id, client_id) VALUES (?, ?)", userId, clientId);
  }
  return true;
}

export async function adminCanViewProperties(userId: string, propertyIds: string[]) {
  if (propertyIds.length === 0) return true;
  const db = await getDb();
  const placeholders = propertyIds.map(() => "?").join(", ");
  const rows = await db.all<{ property_id: string }>(
    `SELECT g.property_id
     FROM admin_listing_grants g
     JOIN properties p ON p.id = g.property_id
     WHERE g.user_id = ? AND IFNULL(p.hidden, 0) = 0 AND g.property_id IN (${placeholders})`,
    userId,
    ...propertyIds,
  );
  return rows.length === propertyIds.length;
}

export async function listClients(options?: { hidden?: boolean }) {
  const db = await getDb();
  const clients = await db.all<User>(
    `SELECT u.*, creator.name AS created_by_name
     FROM users u
     LEFT JOIN users creator ON creator.id = u.created_by
     WHERE u.role = 'client' AND IFNULL(u.hidden, 0) = ?
     ORDER BY u.name COLLATE NOCASE ASC`,
    options?.hidden ? 1 : 0,
  );
  return clients.map(presentClient);
}

export async function insertClient(input: ClientInput, createdBy: string | null = null) {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.run(
    "INSERT INTO users (id, email, name, phone, role, share_token, company_website, company_zip, created_by) VALUES (?, ?, ?, ?, 'client', ?, ?, ?, ?)",
    id,
    clientEmailForStorage(input.email, id),
    input.name,
    input.phone,
    newShareToken(),
    input.companyWebsite,
    input.companyZip,
    createdBy,
  );
  return presentClient((await findUserById(id))!);
}

export async function findClientByShareToken(token: string) {
  const db = await getDb();
  return db.get<User>(
    "SELECT * FROM users WHERE role = 'client' AND share_token = ? AND IFNULL(hidden, 0) = 0",
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
  await db.run("DELETE FROM admin_client_grants WHERE client_id = ?", id);
  await db.run("DELETE FROM admin_client_edits WHERE client_id = ?", id);
  await db.run("DELETE FROM admin_client_picks WHERE client_id = ?", id);
  await db.run("DELETE FROM admin_client_pick_sets WHERE client_id = ?", id);
  await db.run("DELETE FROM users WHERE id = ? AND role = 'client'", id);
}

const PROPERTY_LIST_SQL = `SELECT p.*, creator.name AS created_by_name, ${COVER_SQL}
  FROM properties p
  LEFT JOIN users creator ON creator.id = p.created_by`;

export async function listProperties(options?: { hidden?: boolean }) {
  const db = await getDb();
  return db.all<PropertyListItem>(
    `${PROPERTY_LIST_SQL}
     WHERE IFNULL(p.hidden, 0) = ?
     ORDER BY p.updated_at DESC`,
    options?.hidden ? 1 : 0,
  );
}

export async function listPropertiesForAdmin(userId: string) {
  const db = await getDb();
  const rows = await db.all<PropertyListItem>(
    `${PROPERTY_LIST_SQL}
     JOIN admin_listing_grants g ON g.property_id = p.id
     WHERE g.user_id = ? AND IFNULL(p.hidden, 0) = 0
     ORDER BY p.updated_at DESC`,
    userId,
  );
  return withAdminListingEdits(userId, rows);
}

export async function listClientsForAdmin(userId: string) {
  const db = await getDb();
  const clients = await db.all<User>(
    `SELECT u.*, creator.name AS created_by_name
     FROM users u
     JOIN admin_client_grants g ON g.client_id = u.id
     LEFT JOIN users creator ON creator.id = u.created_by
     WHERE g.user_id = ? AND u.role = 'client' AND IFNULL(u.hidden, 0) = 0
     ORDER BY u.name COLLATE NOCASE ASC`,
    userId,
  );
  return withAdminClientEdits(userId, clients.map(presentClient));
}

export async function listPropertiesForUser(userId: string) {
  const db = await getDb();
  const client = await db.get<{ created_by: string | null }>(
    "SELECT created_by FROM users WHERE id = ? AND role = 'client' AND IFNULL(hidden, 0) = 0",
    userId,
  );
  if (!client) return [];
  const pickSet = client.created_by ? await hasAdminPickSet(client.created_by, userId) : false;
  const rows = await db.all<PropertyListItem>(
    pickSet
      ? `${PROPERTY_LIST_SQL}
         JOIN admin_client_picks a ON a.property_id = p.id
         WHERE a.admin_id = ? AND a.client_id = ? AND IFNULL(p.hidden, 0) = 0
         ORDER BY p.updated_at DESC`
      : `${PROPERTY_LIST_SQL}
         JOIN property_assignments a ON a.property_id = p.id
         WHERE a.user_id = ? AND IFNULL(p.hidden, 0) = 0
         ORDER BY p.updated_at DESC`,
    ...(pickSet ? [client.created_by, userId] : [userId]),
  );
  return client.created_by ? withAdminListingEdits(client.created_by, rows) : rows;
}

export async function getProperty(id: string) {
  const db = await getDb();
  return db.get<Property>("SELECT * FROM properties WHERE id = ?", id);
}

export async function insertProperty(
  input: PropertyInput,
  coords: { lat: number; lng: number } | null,
  createdBy: string | null = null,
) {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.run(
    `INSERT INTO properties (
      id, address, unit, price_cents, listing_type, neighborhood, sqft, sqft_optional,
      bedrooms, bathrooms, amenities, description, status, is_inactive, key_money_cents,
      possession, terms, frontage, ceiling_height, neighboring_tenants, lat, lng, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    createdBy,
  );
  return id;
}

export async function publishProperty(
  actor: User,
  input: PropertyInput,
  coords: { lat: number; lng: number } | null,
) {
  const id = await insertProperty(input, coords, actor.id);
  if (actor.role === "admin") await grantAdminListing(actor.id, id);
  return id;
}

export async function publishClient(actor: User, input: ClientInput) {
  const client = await insertClient(input, actor.id);
  if (actor.role === "admin") await grantAdminClient(actor.id, client.id);
  return client;
}

export async function setPropertyStatus(id: string, status: ListingStatus) {
  const db = await getDb();
  await db.run(
    `UPDATE properties
     SET status = ?, is_inactive = ?, updated_at = datetime('now')
     WHERE id = ?`,
    status,
    status === "inactive" ? 1 : 0,
    id,
  );
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
  await db.run("DELETE FROM admin_listing_grants WHERE property_id = ?", id);
  await db.run("DELETE FROM admin_listing_edits WHERE property_id = ?", id);
  await db.run("DELETE FROM admin_client_picks WHERE property_id = ?", id);
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

export async function adminCanViewClient(userId: string, clientId: string) {
  const db = await getDb();
  const row = await db.get<{ ok: number }>(
    `SELECT 1 AS ok
     FROM admin_client_grants g
     JOIN users u ON u.id = g.client_id
     WHERE g.user_id = ? AND g.client_id = ? AND u.role = 'client' AND IFNULL(u.hidden, 0) = 0`,
    userId,
    clientId,
  );
  return Boolean(row);
}

export async function adminCanViewProperty(userId: string, propertyId: string) {
  const db = await getDb();
  const row = await db.get<{ ok: number }>(
    `SELECT 1 AS ok
     FROM admin_listing_grants g
     JOIN properties p ON p.id = g.property_id
     WHERE g.user_id = ? AND g.property_id = ? AND IFNULL(p.hidden, 0) = 0`,
    userId,
    propertyId,
  );
  return Boolean(row);
}

export async function userCanSeeProperty(user: { id: string; role: User["role"] }, propertyId: string) {
  const db = await getDb();
  const property = await db.get<{ hidden: number }>("SELECT hidden FROM properties WHERE id = ?", propertyId);
  if (!property) return false;
  if (user.role === "super_admin") return true;
  if (property.hidden) return false;
  if (user.role === "admin") return adminCanViewProperty(user.id, propertyId);
  return userCanViewProperty(user.id, propertyId);
}

export async function userCanViewProperty(userId: string, propertyId: string) {
  const db = await getDb();
  const client = await db.get<{ created_by: string | null }>(
    "SELECT created_by FROM users WHERE id = ? AND role = 'client' AND IFNULL(hidden, 0) = 0",
    userId,
  );
  if (!client) return false;
  const property = await db.get<{ hidden: number }>("SELECT hidden FROM properties WHERE id = ?", propertyId);
  if (!property || property.hidden) return false;
  if (client.created_by && (await hasAdminPickSet(client.created_by, userId))) {
    const pick = await db.get<{ ok: number }>(
      "SELECT 1 AS ok FROM admin_client_picks WHERE admin_id = ? AND client_id = ? AND property_id = ?",
      client.created_by,
      userId,
      propertyId,
    );
    return Boolean(pick);
  }
  const row = await db.get<{ ok: number }>(
    "SELECT 1 AS ok FROM property_assignments WHERE user_id = ? AND property_id = ?",
    userId,
    propertyId,
  );
  return Boolean(row);
}

type ListingOverlay = {
  address: string;
  unit: string | null;
  price_cents: number;
  listing_type: Property["listing_type"];
  neighborhood: string;
  sqft: number | null;
  sqft_optional: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  amenities: string;
  description: string;
  status: ListingStatus;
  is_inactive: number;
  key_money_cents: number | null;
  possession: string;
  terms: string;
  frontage: string;
  ceiling_height: string;
  neighboring_tenants: string;
  lat: number | null;
  lng: number | null;
};

type ClientOverlay = {
  name: string;
  email: string;
  phone: string;
  company_website: string;
  company_zip: string;
};

function listingOverlayFromInput(input: PropertyInput, coords: { lat: number; lng: number } | null): ListingOverlay {
  return {
    address: input.address,
    unit: input.unit,
    price_cents: input.price_cents,
    listing_type: input.listing_type,
    neighborhood: input.neighborhood,
    sqft: input.sqft,
    sqft_optional: input.sqft_optional,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    amenities: serializeAmenities(input.amenities),
    description: input.description,
    status: input.status,
    is_inactive: input.is_inactive,
    key_money_cents: input.key_money_cents,
    possession: input.possession,
    terms: input.terms,
    frontage: input.frontage,
    ceiling_height: input.ceiling_height,
    neighboring_tenants: input.neighboring_tenants,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
  };
}

function listingOverlayFromProperty(property: Property): ListingOverlay {
  return {
    address: property.address,
    unit: property.unit,
    price_cents: property.price_cents,
    listing_type: property.listing_type,
    neighborhood: property.neighborhood,
    sqft: property.sqft,
    sqft_optional: property.sqft_optional,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    amenities: property.amenities,
    description: property.description,
    status: property.status,
    is_inactive: property.is_inactive,
    key_money_cents: property.key_money_cents,
    possession: property.possession,
    terms: property.terms,
    frontage: property.frontage,
    ceiling_height: property.ceiling_height,
    neighboring_tenants: property.neighboring_tenants,
    lat: property.lat,
    lng: property.lng,
  };
}

function readJson<T>(payload: string): T | null {
  try {
    return JSON.parse(payload) as T;
  } catch {
    return null;
  }
}

async function withAdminListingEdits<T extends Property>(adminId: string, rows: T[]) {
  if (rows.length === 0) return rows;
  const db = await getDb();
  const placeholders = rows.map(() => "?").join(", ");
  const edits = await db.all<{ property_id: string; payload: string }>(
    `SELECT property_id, payload FROM admin_listing_edits WHERE admin_id = ? AND property_id IN (${placeholders})`,
    adminId,
    ...rows.map((row) => row.id),
  );
  const byId = new Map(edits.map((edit) => [edit.property_id, edit.payload]));
  return rows.map((row) => {
    const payload = byId.get(row.id);
    if (!payload) return row;
    const data = readJson<Partial<ListingOverlay>>(payload);
    return data ? { ...row, ...data } : row;
  });
}

async function withAdminClientEdits(adminId: string, rows: User[]) {
  if (rows.length === 0) return rows;
  const db = await getDb();
  const placeholders = rows.map(() => "?").join(", ");
  const edits = await db.all<{ client_id: string; payload: string }>(
    `SELECT client_id, payload FROM admin_client_edits WHERE admin_id = ? AND client_id IN (${placeholders})`,
    adminId,
    ...rows.map((row) => row.id),
  );
  const byId = new Map(edits.map((edit) => [edit.client_id, edit.payload]));
  return rows.map((row) => {
    if (row.created_by !== adminId) return row;
    const payload = byId.get(row.id);
    if (!payload) return row;
    const data = readJson<ClientOverlay>(payload);
    return data ? { ...row, ...data } : row;
  });
}

async function hasAdminPickSet(adminId: string, clientId: string) {
  const db = await getDb();
  const row = await db.get<{ ok: number }>(
    "SELECT 1 AS ok FROM admin_client_pick_sets WHERE admin_id = ? AND client_id = ?",
    adminId,
    clientId,
  );
  return Boolean(row);
}

export async function grantAdminListing(adminId: string, propertyId: string) {
  const db = await getDb();
  await db.run(
    "INSERT OR IGNORE INTO admin_listing_grants (user_id, property_id) VALUES (?, ?)",
    adminId,
    propertyId,
  );
}

export async function grantAdminClient(adminId: string, clientId: string) {
  const db = await getDb();
  await db.run(
    "INSERT OR IGNORE INTO admin_client_grants (user_id, client_id) VALUES (?, ?)",
    adminId,
    clientId,
  );
}

export async function removeAdminListingGrant(adminId: string, propertyId: string) {
  const db = await getDb();
  await db.run("DELETE FROM admin_listing_grants WHERE user_id = ? AND property_id = ?", adminId, propertyId);
}

export async function removeAdminClientGrant(adminId: string, clientId: string) {
  const db = await getDb();
  await db.run("DELETE FROM admin_client_grants WHERE user_id = ? AND client_id = ?", adminId, clientId);
}

export async function saveListingOverlay(
  adminId: string,
  propertyId: string,
  input: PropertyInput,
  coords: { lat: number; lng: number } | null,
) {
  const db = await getDb();
  await db.run(
    `INSERT INTO admin_listing_edits (admin_id, property_id, payload, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(admin_id, property_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
    adminId,
    propertyId,
    JSON.stringify(listingOverlayFromInput(input, coords)),
  );
}

export async function saveListingStatusOverlay(adminId: string, property: Property, status: ListingStatus) {
  const db = await getDb();
  const existing = await db.get<{ payload: string }>(
    "SELECT payload FROM admin_listing_edits WHERE admin_id = ? AND property_id = ?",
    adminId,
    property.id,
  );
  const base = (existing && readJson<ListingOverlay>(existing.payload)) || listingOverlayFromProperty(property);
  base.status = status;
  base.is_inactive = status === "inactive" ? 1 : 0;
  await db.run(
    `INSERT INTO admin_listing_edits (admin_id, property_id, payload, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(admin_id, property_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
    adminId,
    property.id,
    JSON.stringify(base),
  );
}

export async function saveClientOverlay(adminId: string, clientId: string, input: ClientInput) {
  const db = await getDb();
  const payload: ClientOverlay = {
    name: input.name,
    email: input.email,
    phone: input.phone,
    company_website: input.companyWebsite,
    company_zip: input.companyZip,
  };
  await db.run(
    `INSERT INTO admin_client_edits (admin_id, client_id, payload, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(admin_id, client_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
    adminId,
    clientId,
    JSON.stringify(payload),
  );
}

export async function propertyForEditor(adminId: string, property: Property) {
  return (await withAdminListingEdits(adminId, [property]))[0];
}

export async function clientAsCreatorSees(client: User) {
  const presented = presentClient(client);
  if (!client.created_by) return presented;
  return (await withAdminClientEdits(client.created_by, [presented]))[0];
}

export async function listingForClient(client: User, property: Property) {
  if (!client.created_by) return property;
  return (await withAdminListingEdits(client.created_by, [property]))[0];
}

export async function listingEditor(user: User, propertyId: string) {
  const property = await getProperty(propertyId);
  if (!property) return "missing" as const;
  if (user.role === "super_admin") return { property, master: true as const };
  if (user.role === "admin" && property.created_by === user.id && !property.hidden) {
    return { property, master: false as const };
  }
  return "forbidden" as const;
}

export async function clientEditor(user: User, clientId: string) {
  const client = await findUserById(clientId);
  if (!client || client.role !== "client") return "missing" as const;
  if (user.role === "super_admin") return { client, master: true as const };
  if (client.hidden) return "missing" as const;
  if (user.role === "admin" && client.created_by === user.id && (await adminCanViewClient(user.id, client.id))) {
    return { client, master: false as const };
  }
  return "forbidden" as const;
}

export async function replaceAdminClientPicks(adminId: string, clientId: string, propertyIds: string[]) {
  const db = await getDb();
  if (propertyIds.length > 0) {
    const placeholders = propertyIds.map(() => "?").join(", ");
    const found = await db.all<{ id: string }>(
      `SELECT p.id
       FROM properties p
       JOIN admin_listing_grants g ON g.property_id = p.id AND g.user_id = ?
       WHERE p.id IN (${placeholders}) AND IFNULL(p.hidden, 0) = 0`,
      adminId,
      ...propertyIds,
    );
    if (found.length !== propertyIds.length) return false;
  }
  await db.run("DELETE FROM admin_client_picks WHERE admin_id = ? AND client_id = ?", adminId, clientId);
  for (const propertyId of propertyIds) {
    await db.run(
      "INSERT INTO admin_client_picks (admin_id, client_id, property_id) VALUES (?, ?, ?)",
      adminId,
      clientId,
      propertyId,
    );
  }
  await db.run(
    "INSERT OR IGNORE INTO admin_client_pick_sets (admin_id, client_id) VALUES (?, ?)",
    adminId,
    clientId,
  );
  return true;
}

export async function assignmentIdsForAdminView(adminId: string, client: User, masterIds: string[]) {
  if (client.created_by !== adminId) return masterIds;
  if (!(await hasAdminPickSet(adminId, client.id))) return masterIds;
  const db = await getDb();
  const rows = await db.all<{ property_id: string }>(
    "SELECT property_id FROM admin_client_picks WHERE admin_id = ? AND client_id = ?",
    adminId,
    client.id,
  );
  return rows.map((row) => row.property_id);
}

export async function setPropertyHidden(id: string, hidden: boolean) {
  const db = await getDb();
  await db.run("UPDATE properties SET hidden = ?, updated_at = datetime('now') WHERE id = ?", hidden ? 1 : 0, id);
  if (!hidden) return;
  await db.run("DELETE FROM admin_listing_grants WHERE property_id = ?", id);
  await db.run("DELETE FROM admin_listing_edits WHERE property_id = ?", id);
  await db.run("DELETE FROM admin_client_picks WHERE property_id = ?", id);
}

export async function setClientHidden(id: string, hidden: boolean) {
  const db = await getDb();
  await db.run("UPDATE users SET hidden = ? WHERE id = ? AND role = 'client'", hidden ? 1 : 0, id);
  if (!hidden) return;
  await db.run("DELETE FROM admin_client_grants WHERE client_id = ?", id);
  await db.run("DELETE FROM admin_client_edits WHERE client_id = ?", id);
  await db.run("DELETE FROM admin_client_picks WHERE client_id = ?", id);
  await db.run("DELETE FROM admin_client_pick_sets WHERE client_id = ?", id);
}

export async function setClientFlag(id: string, flagged: boolean, note: string) {
  const db = await getDb();
  await db.run(
    "UPDATE users SET flagged = ?, flag_note = ? WHERE id = ? AND role = 'client'",
    flagged ? 1 : 0,
    flagged ? note.trim() : "",
    id,
  );
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
